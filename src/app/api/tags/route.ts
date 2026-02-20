import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RawTagRow {
  id: number;
  name: string;
  slug: string;
  icon: string;
  legacy_icon_path?: string | null;
  group_label?: string;
  group_order?: number;
  tag_order?: number;
}

function parseLimit(value: string | null, fallback = 20): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

function parseIds(value: string | null): number[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
}

function parseBoolean(value: string | null): boolean | null {
  if (value === null) return null;
  const lowered = value.trim().toLowerCase();
  if (lowered === 'true' || lowered === '1') return true;
  if (lowered === 'false' || lowered === '0') return false;
  return null;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const status = req.nextUrl.searchParams.get('status');
  const query = (req.nextUrl.searchParams.get('query') || '').trim();
  const limit = parseLimit(req.nextUrl.searchParams.get('limit'), 20);
  const ids = parseIds(req.nextUrl.searchParams.get('ids'));
  const featured = parseBoolean(req.nextUrl.searchParams.get('featured'));
  let legacyTagIconsEnabled = true;

  const { data: authData } = await supabase.auth.getUser();
  if (authData.user?.id) {
    const { data: profilePrefs } = await supabase
      .from('profiles')
      .select('legacy_tag_icons_enabled')
      .eq('id', authData.user.id)
      .single();
    legacyTagIconsEnabled = profilePrefs?.legacy_tag_icons_enabled !== false;
  }

  if (status && status !== 'approved') {
    return NextResponse.json({ tags: [] });
  }

  const { data, error } = await supabase.rpc('get_tag_picker_options', {
    input_query: query || null,
    input_limit: limit,
    input_featured: featured,
    input_ids: ids.length > 0 ? ids : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const tags = ((data || []) as RawTagRow[]).map((tag) => ({ ...tag }));
  const tagIds = tags.map((tag) => tag.id).filter((id) => Number.isFinite(id) && id > 0);

  if (tagIds.length > 0) {
    const { data: iconRows } = await supabase
      .from('tags')
      .select('id, icon, legacy_icon_path')
      .in('id', tagIds);

    const iconById = new Map<number, string>();
    for (const row of (iconRows || []) as { id: number; icon: string | null; legacy_icon_path: string | null }[]) {
      const legacyIconPath = (row.legacy_icon_path || '').trim();
      const icon = (row.icon || '').trim();
      iconById.set(row.id, (legacyTagIconsEnabled ? legacyIconPath : '') || icon || '🏷️');
    }

    for (const tag of tags) {
      tag.icon = iconById.get(tag.id) || tag.icon || '🏷️';
    }
  }

  return NextResponse.json({ tags });
}
