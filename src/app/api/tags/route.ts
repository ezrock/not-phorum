import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TagRow {
  id: number;
  name: string;
  slug: string;
  icon?: string;
  group_label?: string;
  group_order?: number;
  tag_order?: number;
  status?: string;
  featured?: boolean;
  redirect_to_tag_id?: number | null;
}

interface TagAliasSearchRow {
  tag_id: number;
}

interface GroupIdRow {
  id: number;
}

interface GroupAliasSearchRow {
  group_id: number;
}

interface GroupMemberRow {
  group_id: number;
  tag_id: number;
  sort_order?: number;
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

  let qb = supabase
    .from('tags')
    .select('id, name, slug, icon');

  if (ids.length > 0) {
    qb = qb.in('id', ids);
  }

  if (status) {
    qb = qb.eq('status', status);
  }

  if (featured !== null) {
    qb = qb.eq('featured', featured);
  }

  // Autocomplete and list endpoints should expose only canonical tags by default.
  qb = qb.is('redirect_to_tag_id', null);

  if (query.length > 0) {
    const [tagMatchRes, aliasMatchRes, groupMatchRes, groupAliasMatchRes] = await Promise.all([
      supabase
        .from('tags')
        .select('id')
        .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
        .is('redirect_to_tag_id', null),
      supabase
        .from('tag_aliases')
        .select('tag_id')
        .ilike('alias', `%${query}%`),
      supabase
        .from('tag_groups')
        .select('id')
        .eq('searchable', true)
        .in('group_kind', ['search', 'both'])
        .or(`name.ilike.%${query}%,slug.ilike.%${query}%`),
      supabase
        .from('tag_group_aliases')
        .select('group_id')
        .ilike('alias', `%${query}%`),
    ]);

    const directIds = (tagMatchRes.data || []).map((row) => Number((row as { id: number }).id));
    const aliasIds = (aliasMatchRes.data || []).map((row) => Number((row as TagAliasSearchRow).tag_id));
    const groupIdsFromDirect = (groupMatchRes.data || []).map((row) => Number((row as GroupIdRow).id));
    const groupIdsFromAliases = (groupAliasMatchRes.data || []).map((row) => Number((row as GroupAliasSearchRow).group_id));
    const matchedGroupIds = Array.from(
      new Set([...groupIdsFromDirect, ...groupIdsFromAliases].filter((id) => Number.isFinite(id) && id > 0))
    );

    let groupMemberTagIds: number[] = [];
    if (matchedGroupIds.length > 0) {
      const [{ data: groupsData }, { data: groupMembersData }] = await Promise.all([
        supabase
          .from('tag_groups')
          .select('id, group_kind, searchable')
          .in('id', matchedGroupIds),
        supabase
          .from('tag_group_members')
          .select('group_id, tag_id, sort_order')
          .in('group_id', matchedGroupIds),
      ]);

      const searchGroupIds = new Set(
        ((groupsData || []) as { id: number; group_kind?: string; searchable?: boolean }[])
          .filter((group) => group.searchable === true && (group.group_kind === 'search' || group.group_kind === 'both'))
          .map((group) => Number(group.id))
      );

      groupMemberTagIds = ((groupMembersData || []) as GroupMemberRow[])
        .filter((row) => searchGroupIds.has(Number(row.group_id)))
        .map((row) => Number(row.tag_id))
        .filter((id) => Number.isFinite(id) && id > 0);
    }

    const searchedIds = Array.from(
      new Set([...directIds, ...aliasIds, ...groupMemberTagIds].filter((id) => Number.isFinite(id) && id > 0))
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

  const tags = (data || []) as TagRow[];
  if (tags.length === 0) {
    return NextResponse.json({ tags: [] });
  }

  const tagIds = tags.map((tag) => tag.id);
  const [{ data: membershipsData }, { data: groupsData }] = await Promise.all([
    supabase
      .from('tag_group_members')
      .select('group_id, tag_id, sort_order')
      .in('tag_id', tagIds),
    supabase
      .from('tag_groups')
      .select('id, name, group_kind, arrangement_order'),
  ]);

  const groupsById = new Map(
    ((groupsData || []) as { id: number; name?: string; group_kind?: string; arrangement_order?: number }[])
      .map((group) => [
        Number(group.id),
        {
          name: String(group.name || ''),
          kind: String(group.group_kind || ''),
          arrangementOrder: Number(group.arrangement_order ?? 0),
        },
      ])
  );

  const firstArrangementGroupByTagId = new Map<number, { name: string; arrangementOrder: number; tagOrder: number }>();
  ((membershipsData || []) as GroupMemberRow[]).forEach((row) => {
    const group = groupsById.get(Number(row.group_id));
    const kind = group?.kind || '';
    if (!(kind === 'arrangement' || kind === 'both')) return;

    const tagId = Number(row.tag_id);
    const groupName = group?.name || '';
    const arrangementOrder = Number(group?.arrangementOrder ?? 0);
    const tagOrder = Number(row.sort_order ?? 0);
    if (!groupName) return;

    const existing = firstArrangementGroupByTagId.get(tagId);
    if (
      !existing
      || arrangementOrder < existing.arrangementOrder
      || (arrangementOrder === existing.arrangementOrder && tagOrder < existing.tagOrder)
      || (arrangementOrder === existing.arrangementOrder && groupName.localeCompare(existing.name, 'fi') < 0)
    ) {
      firstArrangementGroupByTagId.set(tagId, { name: groupName, arrangementOrder, tagOrder });
    }
  });

  const enrichedTags = tags.map((tag) => {
    const group = firstArrangementGroupByTagId.get(tag.id);
    return {
      ...tag,
      group_label: group?.name || undefined,
      group_order: group?.arrangementOrder || undefined,
      tag_order: group?.tagOrder,
    };
  });

  const sortedTags = [...enrichedTags].sort((a, b) => {
    const aHasGroup = typeof a.group_order === 'number';
    const bHasGroup = typeof b.group_order === 'number';

    if (aHasGroup && bHasGroup) {
      const byGroupOrder = (a.group_order as number) - (b.group_order as number);
      if (byGroupOrder !== 0) return byGroupOrder;

      const byGroupLabel = String(a.group_label || '').localeCompare(String(b.group_label || ''), 'fi');
      if (byGroupLabel !== 0) return byGroupLabel;

      const byTagOrder = Number(a.tag_order ?? Number.MAX_SAFE_INTEGER) - Number(b.tag_order ?? Number.MAX_SAFE_INTEGER);
      if (byTagOrder !== 0) return byTagOrder;

      return a.name.localeCompare(b.name, 'fi');
    }

    if (aHasGroup && !bHasGroup) return -1;
    if (!aHasGroup && bHasGroup) return 1;

    return a.name.localeCompare(b.name, 'fi');
  });

  return NextResponse.json({ tags: sortedTags.slice(0, limit) });
}
