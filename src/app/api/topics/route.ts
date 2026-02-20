import { NextRequest, NextResponse } from 'next/server';
import { UI_PAGING_SETTINGS } from '@/lib/uiSettings';
import { createClient } from '@/lib/supabase/server';

interface RawTopicRow {
  id: number;
  title: string;
  views: number;
  views_unique: number;
  created_at: string;
  category_name: string;
  category_icon: string;
  author_username: string;
  replies_count: number;
  last_post_id: number | null;
  last_post_created_at: string | null;
  jump_post_id: number | null;
  unread_count: number;
  has_new: boolean;
}

interface RawTagIconRow {
  name: string;
  icon: string | null;
  legacy_icon_path: string | null;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseTagIds(raw: string | null): number[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function parseMatchMode(value: string | null): boolean {
  return (value || '').toLowerCase() === 'all';
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1);
  const pageSize = Math.min(parsePositiveInt(req.nextUrl.searchParams.get('page_size'), UI_PAGING_SETTINGS.forumShowMoreStep), 100);
  const tagIds = parseTagIds(req.nextUrl.searchParams.get('tag_ids'));
  const matchAll = parseMatchMode(req.nextUrl.searchParams.get('match'));
  const { data: canonicalIdsRaw, error: canonicalError } = await supabase.rpc('resolve_canonical_tag_ids', {
    input_tag_ids: tagIds,
  });
  if (canonicalError) {
    return NextResponse.json({ error: canonicalError.message }, { status: 400 });
  }
  const canonicalTagIds = Array.isArray(canonicalIdsRaw)
    ? canonicalIdsRaw
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;
  let excludedTagIds: number[] = [];
  let legacyTagIconsEnabled = true;

  if (userId) {
    const { data: profilePrefs } = await supabase
      .from('profiles')
      .select('hidden_tag_ids, hidden_tag_group_ids, legacy_tag_icons_enabled')
      .eq('id', userId)
      .single();
    legacyTagIconsEnabled = profilePrefs?.legacy_tag_icons_enabled !== false;

    const hiddenTagIds = Array.isArray(profilePrefs?.hidden_tag_ids)
      ? profilePrefs.hidden_tag_ids
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isFinite(value) && value > 0)
      : [];

    const hiddenTagGroupIds = Array.isArray(profilePrefs?.hidden_tag_group_ids)
      ? profilePrefs.hidden_tag_group_ids
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isFinite(value) && value > 0)
      : [];

    let hiddenGroupTagIds: number[] = [];
    if (hiddenTagGroupIds.length > 0) {
      const { data: groupMembers } = await supabase
        .from('tag_group_members')
        .select('tag_id')
        .in('group_id', hiddenTagGroupIds);

      hiddenGroupTagIds = Array.isArray(groupMembers)
        ? groupMembers
            .map((row) => Number.parseInt(String(row.tag_id), 10))
            .filter((value) => Number.isFinite(value) && value > 0)
        : [];
    }

    const rawExcluded = Array.from(new Set([...hiddenTagIds, ...hiddenGroupTagIds]));
    if (rawExcluded.length > 0) {
      const { data: canonicalExcludedRaw } = await supabase.rpc('resolve_canonical_tag_ids', {
        input_tag_ids: rawExcluded,
      });
      excludedTagIds = Array.isArray(canonicalExcludedRaw)
        ? canonicalExcludedRaw
            .map((value) => Number.parseInt(String(value), 10))
            .filter((value) => Number.isFinite(value) && value > 0)
        : [];
    }
  }

  const [{ data: topicsData, error: topicsError }, { data: totalCountData, error: totalError }] = await Promise.all([
    supabase.rpc('get_topic_list_state_filtered_with_exclusions', {
      input_page: page,
      input_page_size: pageSize,
      input_tag_ids: canonicalTagIds,
      input_match_all: matchAll,
      input_excluded_tag_ids: excludedTagIds,
    }),
    supabase.rpc('get_topic_count_filtered_with_exclusions', {
      input_tag_ids: canonicalTagIds,
      input_match_all: matchAll,
      input_excluded_tag_ids: excludedTagIds,
    }),
  ]);

  let finalTopicsData = topicsData;
  let finalTotalCountData = totalCountData;
  let finalTopicsError = topicsError;
  let finalTotalError = totalError;

  const shouldFallbackToLegacyRpc = Boolean(topicsError || totalError);

  if (shouldFallbackToLegacyRpc) {
    const [{ data: legacyTopicsData, error: legacyTopicsError }, { data: legacyTotalCountData, error: legacyTotalError }] = await Promise.all([
      supabase.rpc('get_topic_list_state_filtered', {
        input_page: page,
        input_page_size: pageSize,
        input_tag_ids: canonicalTagIds,
        input_match_all: matchAll,
      }),
      supabase.rpc('get_topic_count_filtered', {
        input_tag_ids: canonicalTagIds,
        input_match_all: matchAll,
      }),
    ]);

    finalTopicsData = legacyTopicsData as RawTopicRow[] | null;
    finalTotalCountData = legacyTotalCountData;
    finalTopicsError = legacyTopicsError;
    finalTotalError = legacyTotalError;
  }

  if (finalTopicsError) {
    const message = shouldFallbackToLegacyRpc
      ? `Topics query failed after legacy fallback: ${finalTopicsError.message}`
      : finalTopicsError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  if (finalTotalError) {
    const message = shouldFallbackToLegacyRpc
      ? `Topics count failed after legacy fallback: ${finalTotalError.message}`
      : finalTotalError.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const topics = ((finalTopicsData || []) as RawTopicRow[]).map((row) => ({ ...row }));
  const categoryNames = Array.from(new Set(topics.map((row) => row.category_name).filter((name) => !!name)));

  if (categoryNames.length > 0) {
    const { data: tagRows } = await supabase
      .from('tags')
      .select('name, icon, legacy_icon_path')
      .is('redirect_to_tag_id', null)
      .in('name', categoryNames);

    const iconByName = new Map<string, string>();
    for (const row of (tagRows || []) as RawTagIconRow[]) {
      const legacyIconPath = (row.legacy_icon_path || '').trim();
      const icon = (row.icon || '').trim();
      iconByName.set(row.name, (legacyTagIconsEnabled ? legacyIconPath : '') || icon || '🏷️');
    }

    for (const row of topics) {
      row.category_icon = iconByName.get(row.category_name) || row.category_icon || '🏷️';
    }
  }

  return NextResponse.json({
    topics,
    page,
    page_size: pageSize,
    total_count: typeof finalTotalCountData === 'number' ? finalTotalCountData : 0,
    filter: {
      tag_ids: canonicalTagIds,
      match: matchAll ? 'all' : 'any',
    },
  });
}
