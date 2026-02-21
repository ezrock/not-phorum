'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
import { useAdminTagManagement } from '@/components/admin/useAdminTagManagement';
import { useAdminPageState } from '@/components/admin/useAdminPageState';

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
const ADMIN_TAB_LABEL: Record<AdminTab, string> = {
  board: 'Boardi',
  events: 'Tapahtumat',
  trophies: 'Pokaalit',
  users: 'Käyttäjät',
  tags: 'Tagit',
  tag_groups: 'Tagiryhmät',
  levels: 'Tasot',
};
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
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;
  const tagManagement = useAdminTagManagement(supabase);
  const adminState = useAdminPageState(supabase);

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

  if (loading || adminState.loading) {
    return (
      <div className="page-container">
        <Card>
          <p className="state-empty-text">Ladataan...</p>
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

  const activeTabContent: Record<AdminTab, ReactNode> = {
    board: (
      <Card>
        <div className="section-head-row">
          {showHeaderIcons && <Settings2 size={24} className="text-yellow-600" />}
          <h2 className="card-title mb-0">Boardin asetukset</h2>
        </div>

        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-gray-600" />
            <div>
              <p className="font-medium">Rekisteröityminen</p>
              <p className="text-muted-sm">
                {adminState.registrationEnabled
                  ? 'Portit auki.'
                  : 'Portit kiinni.'}
              </p>
            </div>
          </div>
          <button
            onClick={adminState.handleToggleRegistration}
            disabled={adminState.toggling}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              adminState.registrationEnabled ? 'bg-green-500' : 'bg-gray-300'
            } ${adminState.toggling ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                adminState.registrationEnabled ? 'translate-x-6' : 'translate-x-1'
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
                <p className="text-muted-sm">
                  {adminState.notificationEnabled ? 'Raita näkyy kirjautuneille käyttäjille' : 'Raita on pois päältä'}
                </p>
              </div>
            </div>
            <button
              onClick={adminState.handleToggleNotification}
              disabled={adminState.notificationToggling}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                adminState.notificationEnabled ? 'bg-green-500' : 'bg-gray-300'
              } ${adminState.notificationToggling ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  adminState.notificationEnabled ? 'translate-x-6' : 'translate-x-1'
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
                value={adminState.notificationMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => adminState.setNotificationMessage(e.target.value)}
                placeholder="Kirjoita ilmoitusviesti..."
              />
              <Button
                type="button"
                variant="primary"
                onClick={adminState.handleSaveNotificationMessage}
                disabled={adminState.savingNotificationMessage}
              >
                {adminState.savingNotificationMessage ? 'Tallennetaan...' : 'Tallenna'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    ),
    users: (
      <UsersSection
        showHeaderIcons={showHeaderIcons}
        pendingUsers={adminState.pendingUsers}
        processingUserId={adminState.processingUserId}
        onSetApprovalStatus={adminState.handleSetApprovalStatus}
      />
    ),
    tags: (
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
    ),
    tag_groups: (
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
    ),
    trophies: (
      <Card>
        <div className="section-head-row">
          {showHeaderIcons && <Trophy size={24} className="text-yellow-600" />}
          <h2 className="card-title mb-0">Pokaalit (Legacy baseline)</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Tunnistettu {adminState.trophyOverview.length} uniikkia kunniamerkkiä. Jaettuja merkkejä yhteensä {adminState.totalAwardedTrophies}.
        </p>

        <div className="space-y-2">
          {adminState.trophyOverview.slice(0, 20).map((trophy) => (
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
                  <p className="text-muted-xs truncate">{trophy.code}</p>
                </div>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm font-bold text-yellow-700">{trophy.points} p</p>
                <p className="text-muted-xs">{trophy.awarded_count} käyttäjällä</p>
              </div>
            </div>
          ))}
        </div>

        {adminState.trophyOverview.length > 20 && (
          <p className="mt-4 text-muted-xs">
            Näytetään 20 ensimmäistä. Loput löytyvät taulusta `admin_trophy_overview`.
          </p>
        )}
      </Card>
    ),
    levels: (
      <Card>
        <h2 className="card-title flex items-center gap-2">
          {showHeaderIcons && <BarChart3 size={20} className="text-yellow-600" />}
          Tasot
        </h2>
        <p className="text-muted-sm">Tasologiikka ja hallinta tulossa tähän korttiin.</p>
      </Card>
    ),
    events: <EventsPanel />,
  };

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center gap-3">
        <Shield size={28} className="text-yellow-600" />
        <h1 className="text-3xl font-bold">Admin</h1>
      </div>

      <div className="page-tabs mb-4">
        {ADMIN_TABS.map((value) => (
          <a
            key={value}
            href={`#${ADMIN_TAB_HASH[value]}`}
            onClick={() => setActiveTab(value)}
            className={`page-tab-button ${activeTab === value ? 'is-active' : ''}`}
          >
            {ADMIN_TAB_LABEL[value]}
          </a>
        ))}
      </div>

      {activeTabContent[activeTab]}
    </div>
  );
}
