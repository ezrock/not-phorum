import { NextRequest, NextResponse } from 'next/server';
import { THREADS_PER_PAGE } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';

interface TopicRow {
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
  has_new: boolean;
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
  const pageSize = Math.min(parsePositiveInt(req.nextUrl.searchParams.get('page_size'), THREADS_PER_PAGE), 100);
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

  const [{ data: topicsData, error: topicsError }, { data: totalCountData, error: totalError }] = await Promise.all([
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

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 400 });
  }
  if (totalError) {
    return NextResponse.json({ error: totalError.message }, { status: 400 });
  }

  return NextResponse.json({
    topics: (topicsData || []) as TopicRow[],
    page,
    page_size: pageSize,
    total_count: typeof totalCountData === 'number' ? totalCountData : 0,
    filter: {
      tag_ids: canonicalTagIds,
      match: matchAll ? 'all' : 'any',
    },
  });
}
