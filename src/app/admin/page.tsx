'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, BarChart3 } from 'lucide-react';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { EventsPanel } from '@/components/admin/EventsPanel';
import { UsersSection } from '@/components/admin/UsersSection';
import { TagsSection } from '@/components/admin/TagsSection';
import { TagGroupsSection } from '@/components/admin/TagGroupsSection';
import { useAdminTagManagement } from '@/components/admin/useAdminTagManagement';
import { useAdminPageState } from '@/components/admin/useAdminPageState';
import { AdminBoardSettingsCard } from '@/components/admin/AdminBoardSettingsCard';
import { AdminTrophiesCard } from '@/components/admin/AdminTrophiesCard';

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
      <AdminBoardSettingsCard
        showHeaderIcons={showHeaderIcons}
        registrationEnabled={adminState.registrationEnabled}
        toggling={adminState.toggling}
        notificationEnabled={adminState.notificationEnabled}
        notificationToggling={adminState.notificationToggling}
        notificationMessage={adminState.notificationMessage}
        savingNotificationMessage={adminState.savingNotificationMessage}
        onToggleRegistration={adminState.handleToggleRegistration}
        onToggleNotification={adminState.handleToggleNotification}
        onNotificationMessageChange={adminState.setNotificationMessage}
        onSaveNotificationMessage={adminState.handleSaveNotificationMessage}
      />
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
      <AdminTrophiesCard
        showHeaderIcons={showHeaderIcons}
        trophyOverview={adminState.trophyOverview}
        totalAwardedTrophies={adminState.totalAwardedTrophies}
      />
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
