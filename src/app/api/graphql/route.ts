import { NextRequest, NextResponse } from 'next/server';
import { THREADS_PER_PAGE } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';

type GraphQLVariables = Record<string, unknown>;

interface GraphQLBody {
  operationName?: string;
  query?: string;
  variables?: GraphQLVariables;
}

function intVar(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function tagIdsVar(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number.parseInt(String(item), 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );
}

function matchAllVar(value: unknown): boolean {
  return value === true || String(value || '').toLowerCase() === 'all';
}

function textVar(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function resolveOperationName(body: GraphQLBody): string {
  if (body.operationName) return body.operationName;
  const query = body.query || '';
  if (query.includes('attachTagsToTopic')) return 'attachTagsToTopic';
  if (query.includes('topicsByTags')) return 'topicsByTags';
  if (query.includes('tags')) return 'tags';
  return '';
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as GraphQLBody | null;
  if (!body) {
    return NextResponse.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 });
  }

  const supabase = await createClient();
  const variables = body.variables || {};
  const op = resolveOperationName(body);

  if (op === 'tags') {
    const status = textVar(variables.status, 'approved');
    const query = textVar(variables.query);
    const limit = Math.min(intVar(variables.limit, 20), 100);

    if (status && status !== 'approved') {
      return NextResponse.json({ data: { tags: [] } });
    }

    let qb = supabase
      .from('tags')
      .select('id, name, slug')
      .order('name', { ascending: true })
      .limit(limit);

    qb = qb.eq('status', 'approved').eq('featured', true).is('redirect_to_tag_id', null);

    if (query) {
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
      const aliasIds = (aliasMatchRes.data || []).map((row) => Number((row as { tag_id: number }).tag_id));
      const searchedIds = Array.from(
        new Set([...directIds, ...aliasIds].filter((id) => Number.isFinite(id) && id > 0))
      );

      if (searchedIds.length === 0) {
        return NextResponse.json({ data: { tags: [] } });
      }
      qb = qb.in('id', searchedIds);
    }

    const { data, error } = await qb;
    if (error) return NextResponse.json({ errors: [{ message: error.message }] }, { status: 400 });
    return NextResponse.json({ data: { tags: data || [] } });
  }

  if (op === 'attachTagsToTopic') {
    const topicId = intVar(variables.topicId, 0);
    const tagIds = tagIdsVar(variables.tagIds);
    if (topicId <= 0 || tagIds.length === 0) {
      return NextResponse.json({ errors: [{ message: 'topicId and tagIds are required' }] }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 });

    const { data: canonicalIdsRaw, error: canonicalError } = await supabase.rpc('resolve_canonical_tag_ids', {
      input_tag_ids: tagIds,
    });
    if (canonicalError) return NextResponse.json({ errors: [{ message: canonicalError.message }] }, { status: 400 });

    const canonicalIds = Array.isArray(canonicalIdsRaw)
      ? canonicalIdsRaw
          .map((value) => Number.parseInt(String(value), 10))
          .filter((id) => Number.isFinite(id) && id > 0)
      : [];
    if (canonicalIds.length === 0) {
      return NextResponse.json({ errors: [{ message: 'No canonical tags found' }] }, { status: 400 });
    }

    const { error: upsertError } = await supabase
      .from('topic_tags')
      .upsert(
        canonicalIds.map((tagId) => ({ topic_id: topicId, tag_id: tagId, created_by: user.id })),
        { onConflict: 'topic_id,tag_id', ignoreDuplicates: true }
      );

    if (upsertError) return NextResponse.json({ errors: [{ message: upsertError.message }] }, { status: 400 });
    return NextResponse.json({ data: { attachTagsToTopic: { topic_id: topicId, tag_ids: canonicalIds } } });
  }

  if (op === 'topicsByTags') {
    const page = intVar(variables.page, 1);
    const pageSize = Math.min(intVar(variables.pageSize, THREADS_PER_PAGE), 100);
    const tagIds = tagIdsVar(variables.tagIds);
    const matchAll = matchAllVar(variables.matchAll);

    const [{ data: topicsData, error: topicsError }, { data: totalCountData, error: totalError }] = await Promise.all([
      supabase.rpc('get_topic_list_state_filtered', {
        input_page: page,
        input_page_size: pageSize,
        input_tag_ids: tagIds,
        input_match_all: matchAll,
      }),
      supabase.rpc('get_topic_count_filtered', {
        input_tag_ids: tagIds,
        input_match_all: matchAll,
      }),
    ]);

    if (topicsError) return NextResponse.json({ errors: [{ message: topicsError.message }] }, { status: 400 });
    if (totalError) return NextResponse.json({ errors: [{ message: totalError.message }] }, { status: 400 });

    return NextResponse.json({
      data: {
        topicsByTags: {
          topics: topicsData || [],
          page,
          page_size: pageSize,
          total_count: typeof totalCountData === 'number' ? totalCountData : 0,
          filter: { tag_ids: tagIds, match: matchAll ? 'all' : 'any' },
        },
      },
    });
  }

  return NextResponse.json(
    {
      errors: [
        {
          message:
            'Unsupported operation. Use one of: tags, topicsByTags, attachTagsToTopic.',
        },
      ],
    },
    { status: 400 }
  );
}
