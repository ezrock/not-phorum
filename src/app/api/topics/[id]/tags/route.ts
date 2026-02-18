import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface TopicTagInsert {
  topic_id: number;
  tag_id: number;
  created_by?: string;
}

interface TopicTagRow {
  tag: { id: number; name: string; slug: string } | { id: number; name: string; slug: string }[] | null;
}

function parseTopicId(raw: string): number | null {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseTagIds(payload: unknown): number[] {
  if (!payload || typeof payload !== 'object') return [];
  const ids = (payload as { tag_ids?: unknown }).tag_ids;
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(
      ids
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function normalizeTagCell(cell: TopicTagRow['tag']): { id: number; name: string; slug: string } | null {
  if (!cell) return null;
  if (Array.isArray(cell)) return cell[0] || null;
  return cell;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const resolved = await params;
  const topicId = parseTopicId(resolved.id);
  if (!topicId) {
    return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('topic_tags')
    .select('tag:tags(id, name, slug)')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const tags = ((data || []) as TopicTagRow[])
    .map((row) => normalizeTagCell(row.tag))
    .filter((tag): tag is { id: number; name: string; slug: string } => !!tag);

  return NextResponse.json({ topic_id: topicId, tags });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const resolved = await params;
  const topicId = parseTopicId(resolved.id);
  if (!topicId) {
    return NextResponse.json({ error: 'Invalid topic id' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const tagIds = parseTagIds(body);
  if (tagIds.length === 0) {
    return NextResponse.json({ error: 'tag_ids must contain at least one id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows: TopicTagInsert[] = tagIds.map((tagId) => ({
    topic_id: topicId,
    tag_id: tagId,
    created_by: user.id,
  }));

  const { error: insertError } = await supabase
    .from('topic_tags')
    .upsert(rows, { onConflict: 'topic_id,tag_id', ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const { data: tagsData, error: tagsError } = await supabase
    .from('topic_tags')
    .select('tag:tags(id, name, slug)')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true });

  if (tagsError) {
    return NextResponse.json({ error: tagsError.message }, { status: 400 });
  }

  const tags = ((tagsData || []) as TopicTagRow[])
    .map((row) => normalizeTagCell(row.tag))
    .filter((tag): tag is { id: number; name: string; slug: string } => !!tag);

  return NextResponse.json({ topic_id: topicId, tags });
}
