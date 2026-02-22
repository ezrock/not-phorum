import type { SearchResult, TagGroupHit, TagHit } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

type SearchProfile = { legacy_tag_icons_enabled?: boolean } | null;

function normalizeTagGroups(rows: Record<string, unknown>[]): TagGroupHit[] {
  return rows.map((row) => ({
    group_id: Number(row.group_id),
    group_name: String(row.group_name ?? ''),
    group_slug: String(row.group_slug ?? ''),
    member_count: Number(row.member_count ?? 0),
    member_tag_ids: Array.isArray(row.member_tag_ids)
      ? row.member_tag_ids
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isFinite(value) && value > 0)
      : [],
  }));
}

async function getCategoryIconByName(
  supabase: SupabaseClient,
  profile: SearchProfile,
  rawResults: SearchResult[]
): Promise<Map<string, string>> {
  const categoryNames = Array.from(
    new Set(rawResults.map((row) => row.category_name).filter((name) => !!name))
  );
  if (categoryNames.length === 0) return new Map<string, string>();

  const legacyTagIconsEnabled = profile?.legacy_tag_icons_enabled !== false;
  const { data: tagRows } = await supabase
    .from('tags')
    .select('name, icon, legacy_icon_path')
    .in('name', categoryNames)
    .is('redirect_to_tag_id', null);

  const iconByName = new Map<string, string>();
  for (const row of (tagRows || []) as Record<string, unknown>[]) {
    const name = String(row.name || '');
    if (!name) continue;
    const legacyIconPath = String(row.legacy_icon_path || '').trim();
    const icon = String(row.icon || '').trim();
    iconByName.set(name, (legacyTagIconsEnabled ? legacyIconPath : '') || icon || '🏷️');
  }
  return iconByName;
}

async function getTagHits(term: string): Promise<TagHit[]> {
  const res = await fetch(`/api/tags?status=approved&query=${encodeURIComponent(term)}&limit=8`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { tags?: TagHit[] };
  return payload.tags || [];
}

export async function performForumSearch({
  supabase,
  profile,
  term,
}: {
  supabase: SupabaseClient;
  profile: SearchProfile;
  term: string;
}): Promise<{ results: SearchResult[]; tagHits: TagHit[]; groupHits: TagGroupHit[]; error: string }> {
  const trimmedTerm = term.trim();
  if (trimmedTerm.length < 2) {
    return { results: [], tagHits: [], groupHits: [], error: '' };
  }

  const [contentRes, tagHits, groupRes] = await Promise.all([
    supabase.rpc('search_forum', {
      search_term: trimmedTerm,
      result_limit: 30,
    }),
    getTagHits(trimmedTerm),
    supabase.rpc('search_tag_groups', {
      input_query: trimmedTerm,
      input_limit: 6,
    }),
  ]);

  let results: SearchResult[] = [];
  let error = '';
  const { data, error: contentError } = contentRes;
  if (contentError || !data) {
    error = contentError?.message || 'Haku epäonnistui';
  } else {
    const rawResults = data as SearchResult[];
    const iconByName = await getCategoryIconByName(supabase, profile, rawResults);
    results = rawResults.map((row) => ({
      ...row,
      category_icon: iconByName.get(row.category_name) || row.category_icon || '🏷️',
    }));
  }

  const groupHits = !groupRes.error && groupRes.data
    ? normalizeTagGroups((groupRes.data || []) as Record<string, unknown>[])
    : [];

  return { results, tagHits, groupHits, error };
}
