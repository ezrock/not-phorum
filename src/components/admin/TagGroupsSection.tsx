import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
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
  onCreateTagGroup: () => void;
  onTagGroupsChange: (updater: (prev: AdminTagGroup[]) => AdminTagGroup[]) => void;
  onGroupTagQueryChange: (groupId: number, value: string) => void;
  onSaveTagGroup: (group: AdminTagGroup) => void;
  onDeleteTagGroup: (groupId: number) => void;
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
  onCreateTagGroup,
  onTagGroupsChange,
  onGroupTagQueryChange,
  onSaveTagGroup,
  onDeleteTagGroup,
  onGroupAliasInputChange,
  onAddGroupAlias,
  onDeleteGroupAlias,
}: TagGroupsSectionProps) {
  return (
    <Card>
      <h2 className="card-title flex items-center gap-2">
        {showHeaderIcons && <BarChart3 size={20} className="text-yellow-600" />}
        Tagiryhmät
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Ryhmät auttavat selaamaan tageja (esim. 8-bit, 16-bit), mutta ryhmiä ei voi valita keskustelun tageiksi.
      </p>
      <p className="text-xs text-gray-500 mb-4">
        Sama tagi voi kuulua useaan ryhmään. Ryhmän nimi ei voi olla sama kuin olemassa olevan tagin nimi.
      </p>
      <AdminActionError message={tagGroupActionError} className="mb-4" />

      <div className="rounded border border-gray-200 bg-gray-50 p-3 mb-4 space-y-2">
        <h3 className="font-semibold text-sm text-gray-800">Luo uusi ryhmä</h3>
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
        <Button
          type="button"
          onClick={onCreateTagGroup}
          disabled={processingGroupId === -1 || !newGroupName.trim()}
        >
          {processingGroupId === -1 ? 'Luodaan...' : 'Luo ryhmä'}
        </Button>
      </div>

      {tagGroups.length === 0 ? (
        <p className="text-sm text-gray-500">Ei ryhmiä vielä.</p>
      ) : (
        <div className="space-y-3">
          {tagGroups.map((group) => (
            <div key={group.group_id} className="rounded border border-gray-200 bg-white p-3 space-y-2">
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
                <span className="text-xs text-gray-500">
                  Jäseniä: {group.member_count}
                </span>
              </div>
              <div>
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
              </div>
              <div>
                <AliasManager
                  label="Ryhmän aliakset"
                  placeholder="Lisää ryhmäalias..."
                  aliases={(tagGroupAliasesByGroupId[group.group_id] || []).map((aliasRow) => ({
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
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  disabled={processingGroupId === group.group_id || !group.group_name.trim()}
                  onClick={() => onSaveTagGroup(group)}
                >
                  Tallenna
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  disabled={processingGroupId === group.group_id}
                  onClick={() => onDeleteTagGroup(group.group_id)}
                >
                  Poista ryhmä
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
