import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TagRow {
  id: number;
  name: string;
  slug: string;
}

function parseLimit(value: string | null, fallback = 20): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const status = req.nextUrl.searchParams.get('status');
  const query = (req.nextUrl.searchParams.get('query') || '').trim();
  const limit = parseLimit(req.nextUrl.searchParams.get('limit'), 20);

  if (status && status !== 'approved') {
    return NextResponse.json({ tags: [] });
  }

  let qb = supabase
    .from('tags')
    .select('id, name, slug')
    .order('name', { ascending: true })
    .limit(limit);

  if (query.length > 0) {
    qb = qb.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);
  }

  const { data, error } = await qb;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tags: (data || []) as TagRow[] });
}
