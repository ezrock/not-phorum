import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TagRow {
  id: number;
  name: string;
  slug: string;
  status?: string;
  featured?: boolean;
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

function normalizeTagName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function slugifyTagName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
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

  let qb = supabase
    .from('tags')
    .select('id, name, slug')
    .order('name', { ascending: true })
    .limit(limit);

  if (ids.length > 0) {
    qb = qb.in('id', ids);
  }

  if (status) {
    qb = qb.eq('status', status);
  }

  if (featured !== null) {
    qb = qb.eq('featured', featured);
  }

  if (query.length > 0) {
    qb = qb.or(`name.ilike.%${query}%,slug.ilike.%${query}%`);
  }

  const { data, error } = await qb;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tags: (data || []) as TagRow[] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { name?: unknown } | null;
  const name = normalizeTagName(body?.name);

  if (name.length < 1) {
    return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ error: 'Tag name is too long' }, { status: 400 });
  }

  const slug = slugifyTagName(name);
  if (slug.length < 1) {
    return NextResponse.json({ error: 'Tag name must contain letters or numbers' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('tags')
    .insert({
      name,
      slug,
      status: 'unreviewed',
      featured: false,
    })
    .select('id, name, slug, status, featured')
    .single();

  if (error) {
    const { data: existingBySlug } = await supabase
      .from('tags')
      .select('id, name, slug, status, featured')
      .eq('slug', slug)
      .maybeSingle();

    if (existingBySlug) {
      return NextResponse.json({ tag: existingBySlug as TagRow });
    }

    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tag: data as TagRow }, { status: 201 });
}
