import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { AddItemPanel } from '@/components/ui/AddItemPanel';
import { TokenInput, type TokenItem, type TokenOption } from '@/components/ui/TokenInput';
import { AliasManager } from '@/components/admin/AliasManager';
import { AdminActionError } from '@/components/admin/AdminActionError';
import type { AdminTagGroup, TagGroupAliasRow } from '@/components/admin/types';

interface TagGroupsSectionProps {
  showHeaderIcons: boolean;
  tagGroupActionError: string;
  newGroupName: string;
  newGroupSlug: string;
  newGroupDescription: string;
  newGroupSearchable: boolean;
  newGroupKind: 'search' | 'arrangement' | 'both';
  processingGroupId: number | null;
  tagGroups: AdminTagGroup[];
  groupTagQueryByGroupId: Record<number, string>;
  tagGroupAliasesByGroupId: Record<number, TagGroupAliasRow[]>;
  groupAliasInputByGroupId: Record<number, string>;
  processingGroupAliasId: number | null;
  addingAliasGroupId: number | null;
  canonicalTagToToken: (tagId: number) => TokenItem | null;
  buildGroupTagOptions: (group: AdminTagGroup) => TokenOption[];
  onNewGroupNameChange: (value: string) => void;
  onNewGroupSlugChange: (value: string) => void;
  onNewGroupDescriptionChange: (value: string) => void;
  onNewGroupSearchableChange: (value: boolean) => void;
  onNewGroupKindChange: (value: 'search' | 'arrangement' | 'both') => void;
  onCreateTagGroup: () => void;
  onTagGroupsChange: (updater: (prev: AdminTagGroup[]) => AdminTagGroup[]) => void;
  onGroupTagQueryChange: (groupId: number, value: string) => void;
  onSaveTagGroup: (group: AdminTagGroup) => void;
  onDeleteTagGroup: (groupId: number) => void;
  onMoveArrangementGroup: (groupId: number, direction: 'up' | 'down') => void;
  onGroupAliasInputChange: (groupId: number, value: string) => void;
  onAddGroupAlias: (groupId: number, value: string) => void;
  onDeleteGroupAlias: (aliasId: number) => void;
}

export function TagGroupsSection({
  showHeaderIcons,
  tagGroupActionError,
  newGroupName,
  newGroupSlug,
  newGroupDescription,
  newGroupSearchable,
  newGroupKind,
  processingGroupId,
  tagGroups,
  groupTagQueryByGroupId,
  tagGroupAliasesByGroupId,
  groupAliasInputByGroupId,
  processingGroupAliasId,
  addingAliasGroupId,
  canonicalTagToToken,
  buildGroupTagOptions,
  onNewGroupNameChange,
  onNewGroupSlugChange,
  onNewGroupDescriptionChange,
  onNewGroupSearchableChange,
  onNewGroupKindChange,
  onCreateTagGroup,
  onTagGroupsChange,
  onGroupTagQueryChange,
  onSaveTagGroup,
  onDeleteTagGroup,
  onMoveArrangementGroup,
  onGroupAliasInputChange,
  onAddGroupAlias,
  onDeleteGroupAlias,
}: TagGroupsSectionProps) {
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [addGroupOpen, setAddGroupOpen] = useState(false);

  const moveMemberTag = (
    groupId: number,
    tagId: number,
    direction: 'up' | 'down'
  ) => {
    onTagGroupsChange((prev) =>
      prev.map((entry) => {
        if (entry.group_id !== groupId) return entry;
        const currentIndex = entry.member_tag_ids.findIndex((id) => id === tagId);
        if (currentIndex < 0) return entry;
        const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (nextIndex < 0 || nextIndex >= entry.member_tag_ids.length) return entry;
        const nextMemberIds = [...entry.member_tag_ids];
        const [moved] = nextMemberIds.splice(currentIndex, 1);
        nextMemberIds.splice(nextIndex, 0, moved);
        return { ...entry, member_tag_ids: nextMemberIds };
      })
    );
  };

  const formatGroupKind = (groupKind: 'search' | 'arrangement' | 'both') => {
    if (groupKind === 'search') return 'vain haku';
    if (groupKind === 'arrangement') return 'vain järjestely';
    return 'haku + järjestely';
  };

  const searchOnlyGroups = tagGroups
    .filter((group) => group.group_kind === 'search')
    .sort((a, b) => a.group_name.localeCompare(b.group_name, 'fi'));

  const arrangementGroups = tagGroups
    .filter((group) => group.group_kind === 'arrangement' || group.group_kind === 'both')
    .sort((a, b) => a.arrangement_order - b.arrangement_order || a.group_name.localeCompare(b.group_name, 'fi'));

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="card-title mb-0 flex items-center gap-2">
          {showHeaderIcons && <BarChart3 size={20} className="text-yellow-600" />}
          Tagiryhmät
        </h2>
        <Button type="button" variant="primary" onClick={() => setAddGroupOpen(true)}>
          Lisää tagiryhmä
        </Button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Ryhmät auttavat selaamaan tageja (esim. 8-bit, 16-bit), mutta ryhmiä ei voi valita keskustelun tageiksi.
      </p>
      <p className="text-muted-xs mb-4">
        Sama tagi voi kuulua useaan ryhmään. Ryhmän nimi ei voi olla sama kuin olemassa olevan tagin nimi.
      </p>
      <AdminActionError message={tagGroupActionError} className="mb-4" />

      <div className="mb-4">
        <AddItemPanel
          title="Luo uusi ryhmä"
          isOpen={addGroupOpen}
          onClose={() => setAddGroupOpen(false)}
          disableClose={processingGroupId === -1}
          onCancel={() => {
            onNewGroupNameChange('');
            onNewGroupSlugChange('');
            onNewGroupDescriptionChange('');
            onNewGroupSearchableChange(true);
            onNewGroupKindChange('both');
          }}
        >
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                value={newGroupName}
                onChange={(e) => onNewGroupNameChange(e.target.value)}
                placeholder="Ryhmän nimi (esim. 8-bit)"
              />
              <Input
                value={newGroupSlug}
                onChange={(e) => onNewGroupSlugChange(e.target.value)}
                placeholder="ryhman-slug (valinnainen)"
              />
            </div>
            <Input
              value={newGroupDescription}
              onChange={(e) => onNewGroupDescriptionChange(e.target.value)}
              placeholder="Kuvaus (valinnainen)"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newGroupSearchable}
                onChange={(e) => onNewGroupSearchableChange(e.target.checked)}
              />
              Näytä ryhmä hakutuloksissa
            </label>
            <label className="block text-sm text-gray-700">
              Ryhmän käyttö
              <select
                value={newGroupKind}
                onChange={(e) => onNewGroupKindChange(e.target.value as 'search' | 'arrangement' | 'both')}
                className="mt-1 w-full max-w-xs rounded-lg border-2 border-gray-300 bg-white px-2 py-1 text-sm focus:border-yellow-400 focus:outline-none"
              >
                <option value="both">Haku + järjestely</option>
                <option value="search">Vain haku</option>
                <option value="arrangement">Vain järjestely</option>
              </select>
            </label>
            <Button
              type="button"
              onClick={onCreateTagGroup}
              disabled={processingGroupId === -1 || !newGroupName.trim()}
            >
              {processingGroupId === -1 ? 'Luodaan...' : 'Luo ryhmä'}
            </Button>
        </AddItemPanel>
      </div>

      {tagGroups.length === 0 ? (
        <p className="text-muted-sm">Ei ryhmiä vielä.</p>
      ) : (
        <div className="space-y-8">
          {[
            { key: 'arrangement', title: 'Haku ja järjestely', groups: arrangementGroups },
            { key: 'search-only', title: 'Vain haku', groups: searchOnlyGroups },

          ].map((section) => (
            <div key={section.key} className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800">{section.title}</h3>
              {section.groups.length === 0 ? (
                <p className="text-muted-xs">Ei ryhmiä tässä osiossa.</p>
              ) : (
                section.groups.map((group) => {
                  const aliases = tagGroupAliasesByGroupId[group.group_id] || [];
                  const isEditing = editingGroupId === group.group_id;
                  const arrangementIndex = arrangementGroups.findIndex((entry) => entry.group_id === group.group_id);

                  return (
                    <div key={group.group_id} className="rounded border border-gray-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium truncate">{group.group_name}</p>
                          <p className="text-muted-xs truncate">
                            Slug: {group.group_slug}
                            {' • '}Käyttö: {formatGroupKind(group.group_kind)}
                            {(group.group_kind === 'arrangement' || group.group_kind === 'both') ? ` • järjestys: ${group.arrangement_order}` : ''}
                            {' • '}Haku: {group.searchable ? 'kyllä' : 'ei'}
                            {' • '}Tageja: {group.member_count}
                            {' • '}Aliakset: {aliases.length > 0 ? aliases.map((alias) => alias.alias).join(', ') : 'ei'}
                          </p>
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-2">
                            {(group.group_kind === 'arrangement' || group.group_kind === 'both') && (
                              <>
                                <button
                                  type="button"
                                  className="admin-compact-btn bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                  disabled={arrangementIndex <= 0 || processingGroupId === group.group_id}
                                  onClick={() => onMoveArrangementGroup(group.group_id, 'up')}
                                  title="Siirrä ylöspäin"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  className="admin-compact-btn bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                  disabled={arrangementIndex < 0 || arrangementIndex >= arrangementGroups.length - 1 || processingGroupId === group.group_id}
                                  onClick={() => onMoveArrangementGroup(group.group_id, 'down')}
                                  title="Siirrä alaspäin"
                                >
                                  ↓
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
                              onClick={() => setEditingGroupId(group.group_id)}
                            >
                              Muokkaa
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        value={group.group_name}
                        onChange={(e) =>
                          onTagGroupsChange((prev) =>
                            prev.map((entry) =>
                              entry.group_id === group.group_id ? { ...entry, group_name: e.target.value } : entry
                            )
                          )
                        }
                        placeholder="Ryhmän nimi"
                      />
                      <Input
                        value={group.group_slug}
                        onChange={(e) =>
                          onTagGroupsChange((prev) =>
                            prev.map((entry) =>
                              entry.group_id === group.group_id ? { ...entry, group_slug: e.target.value } : entry
                            )
                          )
                        }
                        placeholder="Ryhmän slug"
                      />
                    </div>
                    <Input
                      value={group.description || ''}
                      onChange={(e) =>
                        onTagGroupsChange((prev) =>
                          prev.map((entry) =>
                            entry.group_id === group.group_id ? { ...entry, description: e.target.value } : entry
                          )
                        )
                      }
                      placeholder="Kuvaus"
                    />
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={group.searchable}
                          onChange={(e) =>
                            onTagGroupsChange((prev) =>
                              prev.map((entry) =>
                                entry.group_id === group.group_id ? { ...entry, searchable: e.target.checked } : entry
                              )
                            )
                          }
                        />
                        Hakukelpoinen
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <span className="text-xs text-gray-600">Käyttö</span>
                        <select
                          value={group.group_kind}
                          onChange={(e) =>
                            onTagGroupsChange((prev) =>
                              prev.map((entry) =>
                                entry.group_id === group.group_id
                                  ? { ...entry, group_kind: e.target.value as 'search' | 'arrangement' | 'both' }
                                  : entry
                              )
                            )
                          }
                          className="rounded-lg border-2 border-gray-300 bg-white px-2 py-1 text-xs focus:border-yellow-400 focus:outline-none"
                        >
                          <option value="both">Haku + järjestely</option>
                          <option value="search">Vain haku</option>
                          <option value="arrangement">Vain järjestely</option>
                        </select>
                      </label>
                    </div>
                    <TokenInput
                      label="Ryhmän tagit"
                      placeholder="Hae ja lisää tageja..."
                      tokens={group.member_tag_ids
                        .map(canonicalTagToToken)
                        .filter((token): token is TokenItem => token !== null)}
                      query={groupTagQueryByGroupId[group.group_id] || ''}
                      onQueryChange={(value) => onGroupTagQueryChange(group.group_id, value)}
                      options={buildGroupTagOptions(group)}
                      onSelectOption={(option) => {
                        const tagId = Number(option.id);
                        if (!Number.isFinite(tagId) || tagId <= 0) return;
                        onTagGroupsChange((prev) =>
                          prev.map((entry) =>
                            entry.group_id === group.group_id && !entry.member_tag_ids.includes(tagId)
                              ? { ...entry, member_tag_ids: [...entry.member_tag_ids, tagId] }
                              : entry
                          )
                        );
                        onGroupTagQueryChange(group.group_id, '');
                      }}
                      onRemoveToken={(id) => {
                        const tagId = Number(id);
                        if (!Number.isFinite(tagId) || tagId <= 0) return;
                        onTagGroupsChange((prev) =>
                          prev.map((entry) =>
                            entry.group_id === group.group_id
                              ? { ...entry, member_tag_ids: entry.member_tag_ids.filter((entryId) => entryId !== tagId) }
                              : entry
                          )
                        );
                      }}
                      emptyMessage="Ei osumia"
                      disabled={processingGroupId === group.group_id}
                    />
                    {group.member_tag_ids.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-muted-xs">Tagien järjestys haussa</p>
                        <div className="space-y-1">
                          {group.member_tag_ids.map((tagId, index) => {
                            const token = canonicalTagToToken(tagId);
                            const label = token?.label || `#${tagId}`;
                            return (
                              <div
                                key={`${group.group_id}-${tagId}`}
                                className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm"
                              >
                                <span className="truncate">{label}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="admin-compact-btn bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                    disabled={index === 0 || processingGroupId === group.group_id}
                                    onClick={() => moveMemberTag(group.group_id, tagId, 'up')}
                                    title="Siirrä ylöspäin"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-compact-btn bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                                    disabled={index === group.member_tag_ids.length - 1 || processingGroupId === group.group_id}
                                    onClick={() => moveMemberTag(group.group_id, tagId, 'down')}
                                    title="Siirrä alaspäin"
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <AliasManager
                      label="Ryhmän aliakset"
                      placeholder="Lisää ryhmäalias..."
                      aliases={aliases.map((aliasRow) => ({
                        id: aliasRow.alias_id,
                        label: aliasRow.alias,
                      }))}
                      query={groupAliasInputByGroupId[group.group_id] || ''}
                      onQueryChange={(value) => onGroupAliasInputChange(group.group_id, value)}
                      onAddAlias={(value) => onAddGroupAlias(group.group_id, value)}
                      onDeleteAlias={(id) => {
                        const aliasId = Number(id);
                        if (!Number.isFinite(aliasId) || aliasId <= 0) return;
                        onDeleteGroupAlias(aliasId);
                      }}
                      disabled={processingGroupAliasId !== null || addingAliasGroupId === group.group_id}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="admin-compact-btn inline-flex items-center gap-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        disabled={processingGroupId === group.group_id || !group.group_name.trim()}
                        onClick={() => {
                          onSaveTagGroup(group);
                          setEditingGroupId(null);
                        }}
                      >
                        Tallenna
                      </button>
                      <button
                        type="button"
                        className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
                        disabled={processingGroupId === group.group_id}
                        onClick={() => setEditingGroupId(null)}
                      >
                        Peruuta
                      </button>
                      <button
                        type="button"
                        className="admin-compact-btn inline-flex items-center gap-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={processingGroupId === group.group_id}
                        onClick={() => onDeleteTagGroup(group.group_id)}
                      >
                        Poista ryhmä
                      </button>
                    </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
