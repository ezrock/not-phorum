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
import { UsersSection } from '@/components/admin/UsersSection';
import { TagsSection } from '@/components/admin/TagsSection';
import { TagGroupsSection } from '@/components/admin/TagGroupsSection';
import type { PendingUser } from '@/components/admin/types';
import { useAdminTagManagement } from '@/components/admin/useAdminTagManagement';

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
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [totalAwardedTrophies, setTotalAwardedTrophies] = useState(0);
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;
  const tagManagement = useAdminTagManagement(supabase);

  useEffect(() => {
    const fetchAdminData = async () => {
      const [settingsRes, overviewRes, awardedRes] = await Promise.all([
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
          unreviewedTags={tagManagement.unreviewedTags}
          canonicalTags={tagManagement.canonicalTags}
          tagGroups={tagManagement.tagGroups}
          newTagName={tagManagement.newTagName}
          newTagSlug={tagManagement.newTagSlug}
          creatingTag={tagManagement.creatingTag}
          mergeTargetByTagId={tagManagement.mergeTargetByTagId}
          processingTagId={tagManagement.processingTagId}
          tagActionError={tagManagement.tagActionError}
          aliasSearch={tagManagement.aliasSearch}
          editingTagId={tagManagement.editingTagId}
          editingTagName={tagManagement.editingTagName}
          editingTagSlug={tagManagement.editingTagSlug}
          editingTagGroupIds={tagManagement.editingTagGroupIds}
          deleteReplacementTagId={tagManagement.deleteReplacementTagId}
          aliasInputByTagId={tagManagement.aliasInputByTagId}
          tagAliasesByTagId={tagManagement.tagAliasesByTagId}
          addingAliasTagId={tagManagement.addingAliasTagId}
          processingAliasId={tagManagement.processingAliasId}
          onModerateTag={tagManagement.handleModerateTag}
          onMergeTargetChange={(tagId, target) =>
            tagManagement.setMergeTargetByTagId((prev) => ({ ...prev, [tagId]: target }))
          }
          onMergeTag={tagManagement.handleMergeTag}
          onAliasSearchChange={tagManagement.setAliasSearch}
          onBeginRenameTag={tagManagement.beginRenameTag}
          onCancelRenameTag={tagManagement.cancelRenameTag}
          onEditingTagNameChange={tagManagement.setEditingTagName}
          onEditingTagSlugChange={tagManagement.setEditingTagSlug}
          onEditingTagGroupIdsChange={tagManagement.setEditingTagGroupIds}
          onDeleteReplacementTagIdChange={tagManagement.setDeleteReplacementTagId}
          onSaveTagCard={tagManagement.handleSaveTagCard}
          onAliasInputChange={(tagId, value) =>
            tagManagement.setAliasInputByTagId((prev) => ({ ...prev, [tagId]: value }))
          }
          onAddAlias={tagManagement.handleAddAlias}
          onDeleteAlias={tagManagement.handleDeleteAlias}
          onDeleteTag={tagManagement.handleDeleteTag}
          onNewTagNameChange={tagManagement.setNewTagName}
          onNewTagSlugChange={tagManagement.setNewTagSlug}
          onCreateTag={tagManagement.handleCreateTag}
        />
      )}

      {activeTab === 'tag_groups' && (
        <TagGroupsSection
          showHeaderIcons={showHeaderIcons}
          tagGroupActionError={tagManagement.tagGroupActionError}
          newGroupName={tagManagement.newGroupName}
          newGroupSlug={tagManagement.newGroupSlug}
          newGroupDescription={tagManagement.newGroupDescription}
          newGroupSearchable={tagManagement.newGroupSearchable}
          newGroupKind={tagManagement.newGroupKind}
          processingGroupId={tagManagement.processingGroupId}
          tagGroups={tagManagement.tagGroups}
          groupTagQueryByGroupId={tagManagement.groupTagQueryByGroupId}
          tagGroupAliasesByGroupId={tagManagement.tagGroupAliasesByGroupId}
          groupAliasInputByGroupId={tagManagement.groupAliasInputByGroupId}
          processingGroupAliasId={tagManagement.processingGroupAliasId}
          addingAliasGroupId={tagManagement.addingAliasGroupId}
          canonicalTagToToken={tagManagement.canonicalTagToToken}
          buildGroupTagOptions={tagManagement.buildGroupTagOptions}
          onNewGroupNameChange={tagManagement.setNewGroupName}
          onNewGroupSlugChange={tagManagement.setNewGroupSlug}
          onNewGroupDescriptionChange={tagManagement.setNewGroupDescription}
          onNewGroupSearchableChange={tagManagement.setNewGroupSearchable}
          onNewGroupKindChange={tagManagement.setNewGroupKind}
          onCreateTagGroup={tagManagement.handleCreateTagGroup}
          onTagGroupsChange={tagManagement.setTagGroups}
          onGroupTagQueryChange={(groupId, value) =>
            tagManagement.setGroupTagQueryByGroupId((prev) => ({ ...prev, [groupId]: value }))
          }
          onSaveTagGroup={tagManagement.handleSaveTagGroup}
          onDeleteTagGroup={tagManagement.handleDeleteTagGroup}
          onMoveArrangementGroup={tagManagement.handleMoveArrangementGroup}
          onGroupAliasInputChange={(groupId, value) =>
            tagManagement.setGroupAliasInputByGroupId((prev) => ({ ...prev, [groupId]: value }))
          }
          onAddGroupAlias={tagManagement.handleAddGroupAlias}
          onDeleteGroupAlias={tagManagement.handleDeleteGroupAlias}
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
