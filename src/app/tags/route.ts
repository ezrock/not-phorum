import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TagRow {
  id: number;
  name: string;
  slug: string;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const status = req.nextUrl.searchParams.get('status');
  const query = (req.nextUrl.searchParams.get('query') || '').trim();

  if (status && status !== 'approved') {
    return NextResponse.json({ tags: [] });
  }

  let qb = supabase
    .from('tags')
    .select('id, name, slug')
    .order('name', { ascending: true })
    .limit(12);

  if (query.length > 0) {
    qb = qb.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);
  }

  const { data, error } = await qb;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    tags: (data || []) as TagRow[],
  });
}
