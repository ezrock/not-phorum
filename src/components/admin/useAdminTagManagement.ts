import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { TokenOption } from '@/components/ui/TokenInput';
import type {
  AdminTagGroup,
  CanonicalTagOption,
  TagAliasRow,
  TagGroupAliasRow,
  TagModerationAction,
  UnreviewedTag,
} from '@/components/admin/types';

function groupAliasesByTagId(rows: TagAliasRow[]) {
  return rows.reduce<Record<number, TagAliasRow[]>>((acc, row) => {
    if (!acc[row.tag_id]) {
      acc[row.tag_id] = [];
    }
    acc[row.tag_id].push(row);
    return acc;
  }, {});
}

function groupAliasesByGroupId(rows: TagGroupAliasRow[]) {
  return rows.reduce<Record<number, TagGroupAliasRow[]>>((acc, row) => {
    if (!acc[row.group_id]) {
      acc[row.group_id] = [];
    }
    acc[row.group_id].push(row);
    return acc;
  }, {});
}

function normalizeMemberTagIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => Number.parseInt(String(entry), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function normalizeCanonicalTags(rows: Record<string, unknown>[]): CanonicalTagOption[] {
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    usage_count: Number(row.usage_count ?? 0),
    alias_count: Number(row.alias_count ?? 0),
    group_membership_count: Number(row.group_membership_count ?? 0),
    redirect_reference_count: Number(row.redirect_reference_count ?? 0),
  }));
}

export function useAdminTagManagement(supabase: ReturnType<typeof createClient>) {
  const [unreviewedTags, setUnreviewedTags] = useState<UnreviewedTag[]>([]);
  const [canonicalTags, setCanonicalTags] = useState<CanonicalTagOption[]>([]);
  const [tagAliasesByTagId, setTagAliasesByTagId] = useState<Record<number, TagAliasRow[]>>({});
  const [tagGroupAliasesByGroupId, setTagGroupAliasesByGroupId] = useState<Record<number, TagGroupAliasRow[]>>({});
  const [tagGroups, setTagGroups] = useState<AdminTagGroup[]>([]);
  const [aliasInputByTagId, setAliasInputByTagId] = useState<Record<number, string>>({});
  const [groupAliasInputByGroupId, setGroupAliasInputByGroupId] = useState<Record<number, string>>({});
  const [aliasSearch, setAliasSearch] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagSlug, setNewTagSlug] = useState('');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [editingTagSlug, setEditingTagSlug] = useState('');
  const [editingTagGroupIds, setEditingTagGroupIds] = useState<number[]>([]);
  const [deleteReplacementTagId, setDeleteReplacementTagId] = useState<number | ''>('');
  const [mergeTargetByTagId, setMergeTargetByTagId] = useState<Record<number, number | ''>>({});
  const [processingTagId, setProcessingTagId] = useState<number | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [processingGroupId, setProcessingGroupId] = useState<number | null>(null);
  const [processingAliasId, setProcessingAliasId] = useState<number | null>(null);
  const [processingGroupAliasId, setProcessingGroupAliasId] = useState<number | null>(null);
  const [addingAliasTagId, setAddingAliasTagId] = useState<number | null>(null);
  const [addingAliasGroupId, setAddingAliasGroupId] = useState<number | null>(null);
  const [tagActionError, setTagActionError] = useState('');
  const [tagGroupActionError, setTagGroupActionError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSlug, setNewGroupSlug] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupSearchable, setNewGroupSearchable] = useState(true);
  const [newGroupKind, setNewGroupKind] = useState<'search' | 'arrangement' | 'both'>('both');
  const [groupTagQueryByGroupId, setGroupTagQueryByGroupId] = useState<Record<number, string>>({});

  const refreshUnreviewedTags = async () => {
    const { data } = await supabase.rpc('get_unreviewed_tags_with_usage');
    setUnreviewedTags((data ?? []) as UnreviewedTag[]);
  };

  const refreshCanonicalTags = async () => {
    const { data } = await supabase.rpc('get_admin_canonical_tags_with_usage');
    setCanonicalTags(normalizeCanonicalTags((data ?? []) as Record<string, unknown>[]));
  };

  const refreshTagAliases = async () => {
    const { data } = await supabase.rpc('get_tag_aliases');
    setTagAliasesByTagId(groupAliasesByTagId((data ?? []) as TagAliasRow[]));
  };

  const refreshTagGroups = async () => {
    const { data } = await supabase.rpc('get_tag_groups_with_members');
    const normalized = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      group_id: Number(row.group_id),
      group_name: String(row.group_name ?? ''),
      group_slug: String(row.group_slug ?? ''),
      description: row.description ? String(row.description) : null,
      searchable: row.searchable === true,
      group_kind: (String(row.group_kind ?? 'both') as 'search' | 'arrangement' | 'both'),
      arrangement_order: Number(row.arrangement_order ?? 0),
      member_count: Number(row.member_count ?? 0),
      member_tag_ids: normalizeMemberTagIds(row.member_tag_ids),
    })) as AdminTagGroup[];
    setTagGroups(normalized);
  };

  const refreshTagGroupAliases = async () => {
    const { data } = await supabase.rpc('get_tag_group_aliases');
    setTagGroupAliasesByGroupId(groupAliasesByGroupId((data ?? []) as TagGroupAliasRow[]));
  };

  useEffect(() => {
    const fetchTagsDomainData = async () => {
      const [unreviewedTagsRes, canonicalTagsRes, aliasesRes, groupsRes, groupAliasesRes] = await Promise.all([
        supabase.rpc('get_unreviewed_tags_with_usage'),
        supabase.rpc('get_admin_canonical_tags_with_usage'),
        supabase.rpc('get_tag_aliases'),
        supabase.rpc('get_tag_groups_with_members'),
        supabase.rpc('get_tag_group_aliases'),
      ]);

      if (!unreviewedTagsRes.error && unreviewedTagsRes.data) {
        setUnreviewedTags((unreviewedTagsRes.data ?? []) as UnreviewedTag[]);
      }
      if (!canonicalTagsRes.error && canonicalTagsRes.data) {
        setCanonicalTags(normalizeCanonicalTags((canonicalTagsRes.data ?? []) as Record<string, unknown>[]));
      }
      if (!aliasesRes.error && aliasesRes.data) {
        setTagAliasesByTagId(groupAliasesByTagId((aliasesRes.data ?? []) as TagAliasRow[]));
      }
      if (!groupsRes.error && groupsRes.data) {
        const normalized = (groupsRes.data as Record<string, unknown>[]).map((row) => ({
          group_id: Number(row.group_id),
          group_name: String(row.group_name ?? ''),
          group_slug: String(row.group_slug ?? ''),
          description: row.description ? String(row.description) : null,
          searchable: row.searchable === true,
          group_kind: (String(row.group_kind ?? 'both') as 'search' | 'arrangement' | 'both'),
          arrangement_order: Number(row.arrangement_order ?? 0),
          member_count: Number(row.member_count ?? 0),
          member_tag_ids: normalizeMemberTagIds(row.member_tag_ids),
        })) as AdminTagGroup[];
        setTagGroups(normalized);
      }
      if (!groupAliasesRes.error && groupAliasesRes.data) {
        setTagGroupAliasesByGroupId(groupAliasesByGroupId((groupAliasesRes.data ?? []) as TagGroupAliasRow[]));
      }
    };

    fetchTagsDomainData();
  }, [supabase]);

  const handleModerateTag = async (tagId: number, action: TagModerationAction) => {
    setProcessingTagId(tagId);
    const { error } = await supabase.rpc('moderate_tag', {
      input_tag_id: tagId,
      input_action: action,
    });

    if (!error) {
      await refreshUnreviewedTags();
      await refreshCanonicalTags();
    }
    setProcessingTagId(null);
  };

  const handleMergeTag = async (sourceTagId: number) => {
    const targetTagId = mergeTargetByTagId[sourceTagId];
    if (!targetTagId) return;

    setProcessingTagId(sourceTagId);
    const { error } = await supabase.rpc('merge_tags', {
      source_tag_id: sourceTagId,
      target_tag_id: targetTagId,
    });

    if (!error) {
      await refreshUnreviewedTags();
      await refreshCanonicalTags();
      await refreshTagAliases();
      setMergeTargetByTagId((prev) => ({ ...prev, [sourceTagId]: '' }));
    }

    setProcessingTagId(null);
  };

  const handleCreateTag = async () => {
    const normalizedName = newTagName.trim();
    if (!normalizedName) return;

    setTagActionError('');
    setCreatingTag(true);
    const { error } = await supabase.rpc('create_admin_tag', {
      input_name: normalizedName,
      input_slug: newTagSlug.trim() || null,
    });

    if (!error) {
      setNewTagName('');
      setNewTagSlug('');
      await refreshCanonicalTags();
    } else {
      setTagActionError(error.message || 'Tagin luonti epäonnistui');
    }
    setCreatingTag(false);
  };

  const handleAddAlias = async (tagId: number, explicitValue?: string) => {
    const aliasValue = (explicitValue ?? aliasInputByTagId[tagId] ?? '').trim();
    if (!aliasValue) return;
    setTagActionError('');

    setAddingAliasTagId(tagId);
    const { error } = await supabase.rpc('add_tag_alias', {
      input_tag_id: tagId,
      input_alias: aliasValue,
    });

    if (!error) {
      setAliasInputByTagId((prev) => ({ ...prev, [tagId]: '' }));
      await refreshTagAliases();
    } else {
      setTagActionError(error.message || 'Aliaksen lisäys epäonnistui');
    }
    setAddingAliasTagId(null);
  };

  const handleDeleteAlias = async (aliasId: number) => {
    setTagActionError('');
    setProcessingAliasId(aliasId);
    const { error } = await supabase.rpc('delete_tag_alias', {
      input_alias_id: aliasId,
    });

    if (!error) {
      await refreshTagAliases();
    } else {
      setTagActionError(error.message || 'Aliaksen poisto epäonnistui');
    }
    setProcessingAliasId(null);
  };

  const cancelRenameTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagSlug('');
    setEditingTagGroupIds([]);
    setDeleteReplacementTagId('');
  };

  const handleDeleteTag = async (tag: CanonicalTagOption, replacementTagId: number | '') => {
    const replacementLabel =
      replacementTagId === ''
        ? 'off-topic'
        : (canonicalTags.find((candidate) => candidate.id === replacementTagId)?.name || String(replacementTagId));
    const confirmed = window.confirm(
      `Poistetaanko tagi #${tag.name}?\n\n` +
      `Tagin käytöt siirretään tagille: ${replacementLabel}.\n` +
      `Toimintoa ei voi perua.`
    );
    if (!confirmed) return;

    setTagActionError('');
    setProcessingTagId(tag.id);
    const { error } = await supabase.rpc('delete_tag_with_reassignment', {
      input_tag_id: tag.id,
      input_replacement_tag_id: replacementTagId === '' ? null : replacementTagId,
    });

    if (!error) {
      await refreshCanonicalTags();
      await refreshTagAliases();
      await refreshTagGroups();
      await refreshTagGroupAliases();
      if (editingTagId === tag.id) {
        cancelRenameTag();
      }
    } else {
      setTagActionError(error.message || 'Tagin poisto epäonnistui');
    }
    setProcessingTagId(null);
  };

  const beginRenameTag = (tag: CanonicalTagOption) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setEditingTagSlug(tag.slug);
    setEditingTagGroupIds(
      tagGroups
        .filter((group) => group.member_tag_ids.includes(tag.id))
        .map((group) => group.group_id)
    );
    setDeleteReplacementTagId('');
  };

  const handleSaveTagCard = async (tagId: number) => {
    const nextName = editingTagName.trim();
    if (!nextName) return;
    setTagActionError('');

    setProcessingTagId(tagId);
    const { error: renameError } = await supabase.rpc('update_tag_details', {
      input_tag_id: tagId,
      input_name: nextName,
      input_slug: editingTagSlug.trim() || null,
      input_add_old_aliases: true,
    });

    if (renameError) {
      setTagActionError(renameError.message || 'Tagin tallennus epäonnistui');
      setProcessingTagId(null);
      return;
    }

    const { error: groupsError } = await supabase.rpc('set_tag_group_memberships_for_tag', {
      input_tag_id: tagId,
      input_group_ids: editingTagGroupIds,
    });

    if (groupsError) {
      setTagActionError(groupsError.message || 'Tagiryhmien tallennus epäonnistui');
      setProcessingTagId(null);
      return;
    }

    await refreshCanonicalTags();
    await refreshTagAliases();
    await refreshTagGroups();
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagSlug('');
    setEditingTagGroupIds([]);
    setDeleteReplacementTagId('');
    setProcessingTagId(null);
  };

  const handleSaveTagGroup = async (group: AdminTagGroup) => {
    setTagGroupActionError('');
    setProcessingGroupId(group.group_id);
    const { error } = await supabase.rpc('upsert_tag_group', {
      input_group_id: group.group_id,
      input_name: group.group_name.trim(),
      input_slug: group.group_slug.trim(),
      input_description: (group.description || '').trim(),
      input_searchable: group.searchable,
      input_member_tag_ids: group.member_tag_ids,
      input_group_kind: group.group_kind,
      input_arrangement_order: group.arrangement_order,
    });

    if (!error) {
      await refreshTagGroups();
    } else {
      setTagGroupActionError(error.message || 'Tagiryhmän tallennus epäonnistui');
    }
    setProcessingGroupId(null);
  };

  const handleCreateTagGroup = async () => {
    if (!newGroupName.trim()) return;
    setTagGroupActionError('');
    setProcessingGroupId(-1);
    const { error } = await supabase.rpc('upsert_tag_group', {
      input_group_id: null,
      input_name: newGroupName.trim(),
      input_slug: newGroupSlug.trim() || null,
      input_description: newGroupDescription.trim() || null,
      input_searchable: newGroupSearchable,
      input_member_tag_ids: [],
      input_group_kind: newGroupKind,
      input_arrangement_order: null,
    });

    if (!error) {
      setNewGroupName('');
      setNewGroupSlug('');
      setNewGroupDescription('');
      setNewGroupSearchable(true);
      setNewGroupKind('both');
      await refreshTagGroups();
    } else {
      setTagGroupActionError(error.message || 'Tagiryhmän luonti epäonnistui');
    }
    setProcessingGroupId(null);
  };

  const handleDeleteTagGroup = async (groupId: number) => {
    setTagGroupActionError('');
    setProcessingGroupId(groupId);
    const { error } = await supabase.rpc('delete_tag_group', {
      input_group_id: groupId,
    });
    if (!error) {
      await refreshTagGroups();
      await refreshTagGroupAliases();
    } else {
      setTagGroupActionError(error.message || 'Tagiryhmän poisto epäonnistui');
    }
    setProcessingGroupId(null);
  };

  const handleMoveArrangementGroup = async (groupId: number, direction: 'up' | 'down') => {
    const arrangementGroups = [...tagGroups]
      .filter((group) => group.group_kind === 'arrangement' || group.group_kind === 'both')
      .sort((a, b) => a.arrangement_order - b.arrangement_order || a.group_name.localeCompare(b.group_name, 'fi'));

    const currentIndex = arrangementGroups.findIndex((group) => group.group_id === groupId);
    if (currentIndex < 0) return;

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= arrangementGroups.length) return;

    const currentGroup = arrangementGroups[currentIndex];
    const otherGroup = arrangementGroups[swapIndex];

    setTagGroupActionError('');
    setProcessingGroupId(groupId);

    const { error } = await supabase.rpc('swap_tag_group_arrangement_order', {
      input_first_group_id: currentGroup.group_id,
      input_second_group_id: otherGroup.group_id,
    });

    if (error) {
      setTagGroupActionError(error.message || 'Ryhmän järjestyksen muutos epäonnistui');
      setProcessingGroupId(null);
      return;
    }

    await refreshTagGroups();
    setProcessingGroupId(null);
  };

  const handleAddGroupAlias = async (groupId: number, explicitValue?: string) => {
    const value = (explicitValue ?? groupAliasInputByGroupId[groupId] ?? '').trim();
    if (!value) return;

    setTagGroupActionError('');
    setAddingAliasGroupId(groupId);
    const { error } = await supabase.rpc('add_tag_group_alias', {
      input_group_id: groupId,
      input_alias: value,
    });

    if (!error) {
      setGroupAliasInputByGroupId((prev) => ({ ...prev, [groupId]: '' }));
      await refreshTagGroupAliases();
    } else {
      setTagGroupActionError(error.message || 'Tagiryhmän aliaksen lisäys epäonnistui');
    }
    setAddingAliasGroupId(null);
  };

  const handleDeleteGroupAlias = async (aliasId: number) => {
    setTagGroupActionError('');
    setProcessingGroupAliasId(aliasId);
    const { error } = await supabase.rpc('delete_tag_group_alias', {
      input_alias_id: aliasId,
    });
    if (!error) {
      await refreshTagGroupAliases();
    } else {
      setTagGroupActionError(error.message || 'Tagiryhmän aliaksen poisto epäonnistui');
    }
    setProcessingGroupAliasId(null);
  };

  const canonicalTagToToken = (tagId: number) => {
    const tag = canonicalTags.find((entry) => entry.id === tagId);
    if (!tag) return null;
    return {
      id: tag.id,
      label: `#${tag.name}`,
    };
  };

  const buildGroupTagOptions = (group: AdminTagGroup): TokenOption[] => {
    const query = (groupTagQueryByGroupId[group.group_id] || '').trim().toLowerCase();
    return canonicalTags
      .filter((tag) => !group.member_tag_ids.includes(tag.id))
      .filter((tag) => {
        if (!query) return true;
        return tag.name.toLowerCase().includes(query) || tag.slug.toLowerCase().includes(query);
      })
      .map((tag) => ({
        id: tag.id,
        label: `#${tag.name}`,
        meta: `(${tag.slug})`,
      }));
  };

  return {
    unreviewedTags,
    canonicalTags,
    tagAliasesByTagId,
    tagGroupAliasesByGroupId,
    tagGroups,
    aliasInputByTagId,
    groupAliasInputByGroupId,
    aliasSearch,
    newTagName,
    newTagSlug,
    editingTagId,
    editingTagName,
    editingTagSlug,
    editingTagGroupIds,
    deleteReplacementTagId,
    mergeTargetByTagId,
    processingTagId,
    creatingTag,
    processingGroupId,
    processingAliasId,
    processingGroupAliasId,
    addingAliasTagId,
    addingAliasGroupId,
    tagActionError,
    tagGroupActionError,
    newGroupName,
    newGroupSlug,
    newGroupDescription,
    newGroupSearchable,
    newGroupKind,
    groupTagQueryByGroupId,
    setTagGroups,
    setAliasSearch,
    setEditingTagName,
    setEditingTagSlug,
    setEditingTagGroupIds,
    setDeleteReplacementTagId,
    setMergeTargetByTagId,
    setAliasInputByTagId,
    setNewTagName,
    setNewTagSlug,
    setNewGroupName,
    setNewGroupSlug,
    setNewGroupDescription,
    setNewGroupSearchable,
    setNewGroupKind,
    setGroupTagQueryByGroupId,
    setGroupAliasInputByGroupId,
    beginRenameTag,
    cancelRenameTag,
    handleModerateTag,
    handleMergeTag,
    handleCreateTag,
    handleAddAlias,
    handleDeleteAlias,
    handleDeleteTag,
    handleSaveTagCard,
    handleSaveTagGroup,
    handleCreateTagGroup,
    handleDeleteTagGroup,
    handleMoveArrangementGroup,
    handleAddGroupAlias,
    handleDeleteGroupAlias,
    canonicalTagToToken,
    buildGroupTagOptions,
  };
}
