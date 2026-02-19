import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TagRow {
  id: number;
  name: string;
  slug: string;
  icon: string;
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

  return NextResponse.json({ tags: (data || []) as TagRow[] });
}
