'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, UserPlus, Trophy, ScrollText, Settings2, BarChart3 } from 'lucide-react';
import { trophyLocalIconUrl } from '@/lib/trophies';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { EventsPanel } from '@/components/admin/EventsPanel';
import type { TokenOption } from '@/components/ui/TokenInput';
import { UsersSection } from '@/components/admin/UsersSection';
import { TagsSection } from '@/components/admin/TagsSection';
import { TagGroupsSection } from '@/components/admin/TagGroupsSection';
import type {
  AdminTagGroup,
  CanonicalTagOption,
  PendingUser,
  TagAliasRow,
  TagGroupAliasRow,
  TagModerationAction,
  UnreviewedTag,
} from '@/components/admin/types';

interface TrophyOverview {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
  source: string;
  awarded_count: number;
}

type AdminTab = 'board' | 'users' | 'tags' | 'tag_groups' | 'trophies' | 'levels' | 'events';
const ADMIN_TABS: AdminTab[] = ['board', 'events', 'trophies', 'users', 'tags', 'tag_groups', 'levels'];
const ADMIN_TAB_HASH: Record<AdminTab, string> = {
  board: 'board',
  events: 'events',
  trophies: 'trophies',
  users: 'users',
  tags: 'tags',
  tag_groups: 'tag-groups',
  levels: 'levels',
};
const SITE_SETTINGS_UPDATED_EVENT = 'site-settings-updated';

function isAdminTab(value: string): value is AdminTab {
  return ADMIN_TABS.includes(value as AdminTab);
}

function parseAdminHash(value: string): AdminTab | null {
  const normalized = value.replace('#', '').toLowerCase();
  if (normalized === 'tag-groups') return 'tag_groups';
  if (isAdminTab(normalized)) return normalized;
  return null;
}

export default function AdminPage() {
  const { profile, supabase, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('board');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationToggling, setNotificationToggling] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [savingNotificationMessage, setSavingNotificationMessage] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [trophyLoading, setTrophyLoading] = useState(true);
  const [pendingUsersLoading, setPendingUsersLoading] = useState(true);
  const [trophyOverview, setTrophyOverview] = useState<TrophyOverview[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
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
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
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
  const [totalAwardedTrophies, setTotalAwardedTrophies] = useState(0);
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;

  const groupAliasesByTagId = (rows: TagAliasRow[]) => {
    return rows.reduce<Record<number, TagAliasRow[]>>((acc, row) => {
      if (!acc[row.tag_id]) {
        acc[row.tag_id] = [];
      }
      acc[row.tag_id].push(row);
      return acc;
    }, {});
  };

  const groupAliasesByGroupId = (rows: TagGroupAliasRow[]) => {
    return rows.reduce<Record<number, TagGroupAliasRow[]>>((acc, row) => {
      if (!acc[row.group_id]) {
        acc[row.group_id] = [];
      }
      acc[row.group_id].push(row);
      return acc;
    }, {});
  };

  const normalizeMemberTagIds = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((entry) => Number.parseInt(String(entry), 10))
      .filter((entry) => Number.isFinite(entry) && entry > 0);
  };

  const normalizeCanonicalTags = (rows: Record<string, unknown>[]): CanonicalTagOption[] =>
    rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      slug: String(row.slug ?? ''),
      usage_count: Number(row.usage_count ?? 0),
      alias_count: Number(row.alias_count ?? 0),
      group_membership_count: Number(row.group_membership_count ?? 0),
      redirect_reference_count: Number(row.redirect_reference_count ?? 0),
    }));

  useEffect(() => {
    const fetchAdminData = async () => {
      const [settingsRes, overviewRes, awardedRes, unreviewedTagsRes, canonicalTagsRes, aliasesRes, groupsRes, groupAliasesRes] = await Promise.all([
        supabase
          .from('site_settings')
          .select('key, value')
          .in('key', ['registration_enabled', 'notification_enabled', 'notification_message']),
        supabase
          .from('admin_trophy_overview')
          .select('id, code, name, points, icon_path, source, awarded_count')
          .order('points', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('profile_trophies')
          .select('*', { count: 'exact', head: true }),
        supabase.rpc('get_unreviewed_tags_with_usage'),
        supabase.rpc('get_admin_canonical_tags_with_usage'),
        supabase.rpc('get_tag_aliases'),
        supabase.rpc('get_tag_groups_with_members'),
        supabase.rpc('get_tag_group_aliases'),
      ]);
      const pendingRes = await supabase
        .from('profiles')
        .select('id, username, created_at')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true });

      if (settingsRes.data) {
        const settings = settingsRes.data as { key: string; value: string }[];
        const map = new Map(settings.map((row) => [row.key, row.value]));
        setRegistrationEnabled(map.get('registration_enabled') === 'true');
        setNotificationEnabled(map.get('notification_enabled') === 'true');
        setNotificationMessage(map.get('notification_message') || '');
      }
      if (overviewRes.data) {
        setTrophyOverview(overviewRes.data as TrophyOverview[]);
      }
      if (!pendingRes.error && pendingRes.data) {
        setPendingUsers(pendingRes.data as PendingUser[]);
      }
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
      setTotalAwardedTrophies(awardedRes.count || 0);

      setSettingsLoading(false);
      setTrophyLoading(false);
      setPendingUsersLoading(false);
    };

    fetchAdminData();
  }, [supabase]);

  useEffect(() => {
    const syncTabFromHash = () => {
      const tabFromHash = parseAdminHash(window.location.hash);
      if (tabFromHash) {
        setActiveTab(tabFromHash);
      } else if (window.location.hash) {
        setActiveTab('board');
      }
    };

    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  useEffect(() => {
    const nextHash = `#${ADMIN_TAB_HASH[activeTab]}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [activeTab]);

  const handleToggleRegistration = async () => {
    setToggling(true);
    const newValue = !registrationEnabled;

    const { error } = await supabase.rpc('update_site_setting', {
      setting_key: 'registration_enabled',
      setting_value: String(newValue),
    });

    if (!error) {
      setRegistrationEnabled(newValue);
      window.dispatchEvent(new Event(SITE_SETTINGS_UPDATED_EVENT));
    }
    setToggling(false);
  };

  const handleToggleNotification = async () => {
    setNotificationToggling(true);
    const newValue = !notificationEnabled;

    const { error } = await supabase.rpc('update_site_setting', {
      setting_key: 'notification_enabled',
      setting_value: String(newValue),
    });

    if (!error) {
      setNotificationEnabled(newValue);
      window.dispatchEvent(new Event(SITE_SETTINGS_UPDATED_EVENT));
    }

    setNotificationToggling(false);
  };

  const handleSaveNotificationMessage = async () => {
    setSavingNotificationMessage(true);

    await supabase.rpc('update_site_setting', {
      setting_key: 'notification_message',
      setting_value: notificationMessage.trim(),
    });

    window.dispatchEvent(new Event(SITE_SETTINGS_UPDATED_EVENT));
    setSavingNotificationMessage(false);
  };

  const refreshPendingUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });

    setPendingUsers((data ?? []) as PendingUser[]);
  };

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

  const handleSetApprovalStatus = async (userId: string, status: 'approved' | 'rejected') => {
    setProcessingUserId(userId);
    const { error } = await supabase.rpc('set_profile_approval_status', {
      target_user_id: userId,
      new_status: status,
    });

    if (!error) {
      await refreshPendingUsers();
    }
    setProcessingUserId(null);
  };

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

  const cancelRenameTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
    setEditingTagSlug('');
    setEditingTagGroupIds([]);
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

    if (!renameError && !groupsError) {
      await refreshCanonicalTags();
      await refreshTagAliases();
      await refreshTagGroups();
      setEditingTagId(null);
      setEditingTagName('');
      setEditingTagSlug('');
      setEditingTagGroupIds([]);
      setDeleteReplacementTagId('');
    }
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

    const { error: currentError } = await supabase.rpc('upsert_tag_group', {
      input_group_id: currentGroup.group_id,
      input_name: currentGroup.group_name.trim(),
      input_slug: currentGroup.group_slug.trim(),
      input_description: (currentGroup.description || '').trim(),
      input_searchable: currentGroup.searchable,
      input_member_tag_ids: currentGroup.member_tag_ids,
      input_group_kind: currentGroup.group_kind,
      input_arrangement_order: otherGroup.arrangement_order,
    });

    if (currentError) {
      setTagGroupActionError(currentError.message || 'Ryhmän järjestyksen muutos epäonnistui');
      setProcessingGroupId(null);
      return;
    }

    const { error: otherError } = await supabase.rpc('upsert_tag_group', {
      input_group_id: otherGroup.group_id,
      input_name: otherGroup.group_name.trim(),
      input_slug: otherGroup.group_slug.trim(),
      input_description: (otherGroup.description || '').trim(),
      input_searchable: otherGroup.searchable,
      input_member_tag_ids: otherGroup.member_tag_ids,
      input_group_kind: otherGroup.group_kind,
      input_arrangement_order: currentGroup.arrangement_order,
    });

    if (otherError) {
      setTagGroupActionError(otherError.message || 'Ryhmän järjestyksen muutos epäonnistui');
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

  if (loading || settingsLoading || trophyLoading || pendingUsersLoading) {
    return (
      <div className="page-container">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="page-container">
        <Card>
          <h2 className="card-title flex items-center gap-2">
            {showHeaderIcons && <Shield size={20} className="text-yellow-600" />}
            Ei käyttöoikeutta
          </h2>
          <p className="text-gray-500 mt-2">Tämä sivu on vain ylläpitäjille.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={28} className="text-yellow-600" />
        <h1 className="text-3xl font-bold">Admin</h1>
      </div>

      <div className="page-tabs mb-4">
        {(ADMIN_TABS.map((tab) => (
          [
            tab,
            tab === 'board'
              ? 'Boardi'
              : tab === 'events'
                ? 'Tapahtumat'
                : tab === 'trophies'
                  ? 'Pokaalit'
                  : tab === 'users'
                    ? 'Käyttäjät'
                    : tab === 'tags'
                      ? 'Tagit'
                      : tab === 'tag_groups'
                        ? 'Tagiryhmät'
                        : 'Tasot',
          ] as [AdminTab, string]
        ))).map(([value, label]) => (
          <a
            key={value}
            href={`#${ADMIN_TAB_HASH[value]}`}
            onClick={() => setActiveTab(value)}
            className={`page-tab-button ${activeTab === value ? 'is-active' : ''}`}
          >
            {label}
          </a>
        ))}
      </div>

      {activeTab === 'board' && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            {showHeaderIcons && <Settings2 size={24} className="text-yellow-600" />}
            <h2 className="card-title mb-0">Boardin asetukset</h2>
          </div>

          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-3">
              <UserPlus size={20} className="text-gray-600" />
              <div>
                <p className="font-medium">Rekisteröityminen</p>
                <p className="text-sm text-gray-500">
                  {registrationEnabled
                    ? 'Portit auki.'
                    : 'Portit kiinni.'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleRegistration}
              disabled={toggling}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                registrationEnabled ? 'bg-green-500' : 'bg-gray-300'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  registrationEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="section-block">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ScrollText size={20} className="text-gray-600" />
                <div>
                <p className="font-medium">Ilmoitusraita</p>
                <p className="text-sm text-gray-500">
                  {notificationEnabled ? 'Raita näkyy kirjautuneille käyttäjille' : 'Raita on pois päältä'}
                </p>
                </div>
              </div>
              <button
                onClick={handleToggleNotification}
                disabled={notificationToggling}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                  notificationEnabled ? 'bg-green-500' : 'bg-gray-300'
                } ${notificationToggling ? 'opacity-50' : ''}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    notificationEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="notificationMessage" className="block text-sm text-gray-700 mb-1">
                Ilmoitusviesti
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="notificationMessage"
                  value={notificationMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotificationMessage(e.target.value)}
                  placeholder="Kirjoita ilmoitusviesti..."
                />
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveNotificationMessage}
                  disabled={savingNotificationMessage}
                >
                  {savingNotificationMessage ? 'Tallennetaan...' : 'Tallenna'}
                </Button>
              </div>
            </div>
          </div>

        </Card>
      )}

      {activeTab === 'users' && (
        <UsersSection
          showHeaderIcons={showHeaderIcons}
          pendingUsers={pendingUsers}
          processingUserId={processingUserId}
          onSetApprovalStatus={handleSetApprovalStatus}
        />
      )}

      {activeTab === 'tags' && (
        <TagsSection
          showHeaderIcons={showHeaderIcons}
          unreviewedTags={unreviewedTags}
          canonicalTags={canonicalTags}
          tagGroups={tagGroups}
          newTagName={newTagName}
          newTagSlug={newTagSlug}
          creatingTag={creatingTag}
          mergeTargetByTagId={mergeTargetByTagId}
          processingTagId={processingTagId}
          tagActionError={tagActionError}
          aliasSearch={aliasSearch}
          editingTagId={editingTagId}
          editingTagName={editingTagName}
          editingTagSlug={editingTagSlug}
          editingTagGroupIds={editingTagGroupIds}
          deleteReplacementTagId={deleteReplacementTagId}
          aliasInputByTagId={aliasInputByTagId}
          tagAliasesByTagId={tagAliasesByTagId}
          addingAliasTagId={addingAliasTagId}
          processingAliasId={processingAliasId}
          onModerateTag={handleModerateTag}
          onMergeTargetChange={(tagId, target) =>
            setMergeTargetByTagId((prev) => ({ ...prev, [tagId]: target }))
          }
          onMergeTag={handleMergeTag}
          onAliasSearchChange={setAliasSearch}
          onBeginRenameTag={beginRenameTag}
          onCancelRenameTag={cancelRenameTag}
          onEditingTagNameChange={setEditingTagName}
          onEditingTagSlugChange={setEditingTagSlug}
          onEditingTagGroupIdsChange={setEditingTagGroupIds}
          onDeleteReplacementTagIdChange={setDeleteReplacementTagId}
          onSaveTagCard={handleSaveTagCard}
          onAliasInputChange={(tagId, value) =>
            setAliasInputByTagId((prev) => ({ ...prev, [tagId]: value }))
          }
          onAddAlias={handleAddAlias}
          onDeleteAlias={handleDeleteAlias}
          onDeleteTag={handleDeleteTag}
          onNewTagNameChange={setNewTagName}
          onNewTagSlugChange={setNewTagSlug}
          onCreateTag={handleCreateTag}
        />
      )}

      {activeTab === 'tag_groups' && (
        <TagGroupsSection
          showHeaderIcons={showHeaderIcons}
          tagGroupActionError={tagGroupActionError}
          newGroupName={newGroupName}
          newGroupSlug={newGroupSlug}
          newGroupDescription={newGroupDescription}
          newGroupSearchable={newGroupSearchable}
          newGroupKind={newGroupKind}
          processingGroupId={processingGroupId}
          tagGroups={tagGroups}
          groupTagQueryByGroupId={groupTagQueryByGroupId}
          tagGroupAliasesByGroupId={tagGroupAliasesByGroupId}
          groupAliasInputByGroupId={groupAliasInputByGroupId}
          processingGroupAliasId={processingGroupAliasId}
          addingAliasGroupId={addingAliasGroupId}
          canonicalTagToToken={canonicalTagToToken}
          buildGroupTagOptions={buildGroupTagOptions}
          onNewGroupNameChange={setNewGroupName}
          onNewGroupSlugChange={setNewGroupSlug}
          onNewGroupDescriptionChange={setNewGroupDescription}
          onNewGroupSearchableChange={setNewGroupSearchable}
          onNewGroupKindChange={setNewGroupKind}
          onCreateTagGroup={handleCreateTagGroup}
          onTagGroupsChange={setTagGroups}
          onGroupTagQueryChange={(groupId, value) =>
            setGroupTagQueryByGroupId((prev) => ({ ...prev, [groupId]: value }))
          }
          onSaveTagGroup={handleSaveTagGroup}
          onDeleteTagGroup={handleDeleteTagGroup}
          onMoveArrangementGroup={handleMoveArrangementGroup}
          onGroupAliasInputChange={(groupId, value) =>
            setGroupAliasInputByGroupId((prev) => ({ ...prev, [groupId]: value }))
          }
          onAddGroupAlias={handleAddGroupAlias}
          onDeleteGroupAlias={handleDeleteGroupAlias}
        />
      )}

      {activeTab === 'trophies' && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            {showHeaderIcons && <Trophy size={24} className="text-yellow-600" />}
            <h2 className="card-title mb-0">Pokaalit (Legacy baseline)</h2>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Tunnistettu {trophyOverview.length} uniikkia kunniamerkkiä. Jaettuja merkkejä yhteensä {totalAwardedTrophies}.
          </p>

          <div className="space-y-2">
            {trophyOverview.slice(0, 20).map((trophy) => (
              <div key={trophy.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <div className="min-w-0 flex items-center gap-2">
                  {trophyLocalIconUrl(trophy.icon_path) && (
                    <img
                      src={trophyLocalIconUrl(trophy.icon_path) as string}
                      alt={trophy.name}
                      className="w-4 h-5 object-contain flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{trophy.name}</p>
                    <p className="text-xs text-gray-500 truncate">{trophy.code}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-yellow-700">{trophy.points} p</p>
                  <p className="text-xs text-gray-500">{trophy.awarded_count} käyttäjällä</p>
                </div>
              </div>
            ))}
          </div>

          {trophyOverview.length > 20 && (
            <p className="mt-4 text-xs text-gray-500">
              Näytetään 20 ensimmäistä. Loput löytyvät taulusta `admin_trophy_overview`.
            </p>
          )}
        </Card>
      )}

      {activeTab === 'levels' && (
        <Card>
          <h2 className="card-title flex items-center gap-2">
            {showHeaderIcons && <BarChart3 size={20} className="text-yellow-600" />}
            Tasot
          </h2>
          <p className="text-sm text-gray-500">Tasologiikka ja hallinta tulossa tähän korttiin.</p>
        </Card>
      )}

      {activeTab === 'events' && <EventsPanel />}
    </div>
  );
}
