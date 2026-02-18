import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TagRow {
  id: number;
  name: string;
  slug: string;
}

interface TagAliasSearchRow {
  tag_id: number;
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
  const featured = parseBoolean(req.nextUrl.searchParams.get('featured'));

  if (status && status !== 'approved') {
    return NextResponse.json({ tags: [] });
  }

  let qb = supabase
    .from('tags')
    .select('id, name, slug')
    .order('name', { ascending: true })
    .limit(12);

  if (status) {
    qb = qb.eq('status', status);
  }

  if (featured !== null) {
    qb = qb.eq('featured', featured);
  }

  qb = qb.is('redirect_to_tag_id', null);

  if (query.length > 0) {
    const [tagMatchRes, aliasMatchRes] = await Promise.all([
      supabase
        .from('tags')
        .select('id')
        .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
        .is('redirect_to_tag_id', null),
      supabase
        .from('tag_aliases')
        .select('tag_id')
        .ilike('alias', `%${query}%`),
    ]);

    const directIds = (tagMatchRes.data || []).map((row) => Number((row as { id: number }).id));
    const aliasIds = (aliasMatchRes.data || []).map((row) => Number((row as TagAliasSearchRow).tag_id));
    const searchedIds = Array.from(
      new Set([...directIds, ...aliasIds].filter((id) => Number.isFinite(id) && id > 0))
    );

    if (searchedIds.length === 0) {
      return NextResponse.json({ tags: [] });
    }
    qb = qb.in('id', searchedIds);
  }

  const { data, error } = await qb;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    tags: (data || []) as TagRow[],
  });
}
