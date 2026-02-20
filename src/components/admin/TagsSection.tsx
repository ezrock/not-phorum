import { Check, Star, Tags as TagsIcon, X } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { AdminActionError } from '@/components/admin/AdminActionError';
import { AliasManager } from '@/components/admin/AliasManager';
import type { AdminTagGroup, CanonicalTagOption, TagAliasRow, TagModerationAction, UnreviewedTag } from '@/components/admin/types';

interface TagsSectionProps {
  showHeaderIcons: boolean;
  unreviewedTags: UnreviewedTag[];
  canonicalTags: CanonicalTagOption[];
  tagGroups: AdminTagGroup[];
  newTagName: string;
  newTagSlug: string;
  creatingTag: boolean;
  mergeTargetByTagId: Record<number, number | ''>;
  processingTagId: number | null;
  tagActionError: string;
  aliasSearch: string;
  editingTagId: number | null;
  editingTagName: string;
  editingTagSlug: string;
  editingTagGroupIds: number[];
  deleteReplacementTagId: number | '';
  aliasInputByTagId: Record<number, string>;
  tagAliasesByTagId: Record<number, TagAliasRow[]>;
  addingAliasTagId: number | null;
  processingAliasId: number | null;
  onModerateTag: (tagId: number, action: TagModerationAction) => void;
  onMergeTargetChange: (tagId: number, target: number | '') => void;
  onMergeTag: (sourceTagId: number) => void;
  onNewTagNameChange: (value: string) => void;
  onNewTagSlugChange: (value: string) => void;
  onCreateTag: () => void;
  onAliasSearchChange: (value: string) => void;
  onBeginRenameTag: (tag: CanonicalTagOption) => void;
  onCancelRenameTag: () => void;
  onEditingTagNameChange: (value: string) => void;
  onEditingTagSlugChange: (value: string) => void;
  onEditingTagGroupIdsChange: (next: number[]) => void;
  onDeleteReplacementTagIdChange: (next: number | '') => void;
  onSaveTagCard: (tagId: number) => void;
  onAliasInputChange: (tagId: number, value: string) => void;
  onAddAlias: (tagId: number, value: string) => void;
  onDeleteAlias: (aliasId: number) => void;
  onDeleteTag: (tag: CanonicalTagOption, replacementTagId: number | '') => void;
}

export function TagsSection({
  showHeaderIcons,
  unreviewedTags,
  canonicalTags,
  tagGroups,
  newTagName,
  newTagSlug,
  creatingTag,
  mergeTargetByTagId,
  processingTagId,
  tagActionError,
  aliasSearch,
  editingTagId,
  editingTagName,
  editingTagSlug,
  editingTagGroupIds,
  deleteReplacementTagId,
  aliasInputByTagId,
  tagAliasesByTagId,
  addingAliasTagId,
  processingAliasId,
  onModerateTag,
  onMergeTargetChange,
  onMergeTag,
  onNewTagNameChange,
  onNewTagSlugChange,
  onCreateTag,
  onAliasSearchChange,
  onBeginRenameTag,
  onCancelRenameTag,
  onEditingTagNameChange,
  onEditingTagSlugChange,
  onEditingTagGroupIdsChange,
  onDeleteReplacementTagIdChange,
  onSaveTagCard,
  onAliasInputChange,
  onAddAlias,
  onDeleteAlias,
  onDeleteTag,
}: TagsSectionProps) {
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<number | null>(null);

  const renderLegacyIcon = (path: string | null, alt: string) => (
    path ? (
      <img
        src={path}
        alt={alt}
        className="h-4 w-4 flex-shrink-0 object-contain"
      />
    ) : (
      <span className="inline-flex h-4 w-4 items-center justify-center text-xs leading-none">🏷️</span>
    )
  );

  const toggleGroupMembership = (groupId: number) => {
    if (editingTagGroupIds.includes(groupId)) {
      onEditingTagGroupIdsChange(editingTagGroupIds.filter((id) => id !== groupId));
      return;
    }
    onEditingTagGroupIdsChange([...editingTagGroupIds, groupId]);
  };

  return (
    <Card>
      <h2 className="card-title flex items-center gap-2">
        {showHeaderIcons && <TagsIcon size={20} className="text-yellow-600" />}
        Tagit
      </h2>
      <div className="mb-3 space-y-2 text-sm text-gray-600">
        <p>
          Tagit kuvaavat keskustelun aihetta. Uudet keskustelut ovat tagipohjaisia, ja jokaisella keskustelulla on yksi päätagi.
        </p>
      </div>

      {unreviewedTags.length > 0 && (
        <div className="space-y-2">
          {unreviewedTags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{tag.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {tag.slug} • {tag.usage_count} käyttöä • {new Date(tag.created_at).toLocaleString('fi-FI')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={processingTagId === tag.id}
                  onClick={() => onModerateTag(tag.id, 'approve')}
                  className="admin-compact-btn inline-flex items-center gap-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={processingTagId === tag.id}
                  onClick={() => onModerateTag(tag.id, 'feature')}
                  className="admin-compact-btn inline-flex items-center gap-1 bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
                >
                  <Star size={14} />
                  Feature
                </button>
                <button
                  type="button"
                  disabled={processingTagId === tag.id}
                  onClick={() => onModerateTag(tag.id, 'hide')}
                  className="admin-compact-btn inline-flex items-center gap-1 bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <X size={14} />
                  Hide
                </button>
                <select
                  value={mergeTargetByTagId[tag.id] ?? ''}
                  onChange={(e) => onMergeTargetChange(tag.id, e.target.value ? Number(e.target.value) : '')}
                  className="max-w-48 rounded-lg border-2 border-gray-300 bg-white px-2 py-1 text-xs focus:border-yellow-400 focus:outline-none"
                  disabled={processingTagId === tag.id}
                >
                  <option value="">Merge target...</option>
                  {canonicalTags
                    .filter((candidate) => candidate.id !== tag.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={processingTagId === tag.id || !mergeTargetByTagId[tag.id]}
                  onClick={() => onMergeTag(tag.id)}
                  className="admin-compact-btn inline-flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Merge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="font-semibold text-gray-800 mb-2">Kanoniset tagit ja aliakset</h3>
        <p className="text-xs text-gray-500 mb-3">
          Aliakset toimivat hakusynonyymeinä (esim. &quot;pleikka&quot; -&gt; PlayStation 5). Merge siirtää aliakset myös kohdetagille.
        </p>
        <AdminActionError message={tagActionError} className="mb-3" />
        <div className="mb-3 rounded border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-700">Lisää uusi tagi</p>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              value={newTagName}
              onChange={(e) => onNewTagNameChange(e.target.value)}
              placeholder="Tagin nimi"
            />
            <Input
              value={newTagSlug}
              onChange={(e) => onNewTagSlugChange(e.target.value)}
              placeholder="Slug (valinnainen)"
            />
            <Button
              type="button"
              onClick={onCreateTag}
              disabled={creatingTag || !newTagName.trim()}
            >
              {creatingTag ? 'Luodaan...' : 'Lisää tagi'}
            </Button>
          </div>
        </div>
        <div className="mb-3">
          <Input
            value={aliasSearch}
            onChange={(e) => onAliasSearchChange(e.target.value)}
            placeholder="Suodata tageja nimellä tai slugilla..."
          />
        </div>
        <div className="space-y-2">
          {canonicalTags
            .filter((tag) => {
              const q = aliasSearch.trim().toLowerCase();
              if (!q) return true;
              return tag.name.toLowerCase().includes(q) || tag.slug.toLowerCase().includes(q);
            })
            .map((tag) => {
              const aliases = tagAliasesByTagId[tag.id] || [];
              const groupsForTag = tagGroups.filter((group) => group.member_tag_ids.includes(tag.id));
              const isEditing = editingTagId === tag.id;
              const isInUse = tag.usage_count > 0;
              const showDeleteControls = pendingDeleteTagId === tag.id;
              return (
                <div key={tag.id} className="rounded border border-gray-200 bg-white px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium truncate inline-flex items-center gap-1.5">
                        {renderLegacyIcon(tag.legacy_icon_path, `${tag.name} legacy icon`)}
                        <span>{tag.name}</span>
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Slug: {tag.slug} • Käytössä: {tag.usage_count} ketjussa • aliakset:{' '}
                        {aliases.length > 0 ? aliases.map((a) => a.alias).join(', ') : 'ei'} • Ryhmissä:{' '}
                        {groupsForTag.length > 0 ? groupsForTag.map((g) => g.group_name).join(', ') : 'ei'}
                      </p>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
                        onClick={() => onBeginRenameTag(tag)}
                      >
                        Muokkaa
                      </button>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                      <div className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                        {renderLegacyIcon(tag.legacy_icon_path, `${tag.name} legacy icon`)}
                        <span>Legacy-kuvake</span>
                      </div>

                      <div className="flex flex-wrap items-end gap-2">
                        <label className="block w-full max-w-xs text-xs text-gray-600">
                          <span className="inline-flex items-center gap-1.5">
                            {renderLegacyIcon(tag.legacy_icon_path, `${tag.name} legacy icon`)}
                            <span>Tagin nimi</span>
                          </span>
                          <input
                            value={editingTagName}
                            onChange={(e) => onEditingTagNameChange(e.target.value)}
                            className="mt-1 w-full rounded-lg border-2 border-gray-300 bg-white px-2 py-1 text-sm focus:border-yellow-400 focus:outline-none"
                            placeholder="Esim. PlayStation 5"
                          />
                        </label>
                        <label className="block w-full max-w-xs text-xs text-gray-600">
                          Slug
                          <input
                            value={editingTagSlug}
                            onChange={(e) => onEditingTagSlugChange(e.target.value)}
                            className="mt-1 w-full rounded-lg border-2 border-gray-300 bg-white px-2 py-1 text-sm font-mono focus:border-yellow-400 focus:outline-none"
                            placeholder="esim-playstation-5"
                          />
                        </label>
                      </div>

                      <AliasManager
                        label="Tagin aliakset"
                        placeholder="Lisää alias..."
                        aliases={aliases.map((aliasRow) => ({ id: aliasRow.alias_id, label: aliasRow.alias }))}
                        query={aliasInputByTagId[tag.id] || ''}
                        onQueryChange={(value) => onAliasInputChange(tag.id, value)}
                        onAddAlias={(value) => onAddAlias(tag.id, value)}
                        onDeleteAlias={(id) => {
                          const aliasId = Number(id);
                          if (!Number.isFinite(aliasId) || aliasId <= 0) return;
                          onDeleteAlias(aliasId);
                        }}
                        disabled={addingAliasTagId === tag.id || processingAliasId !== null}
                      />

                      <div>
                        <p className="mb-1 text-xs font-semibold text-gray-600">Tagiryhmät</p>
                        <div className="flex flex-wrap gap-2">
                          {tagGroups.map((group) => {
                            const checked = editingTagGroupIds.includes(group.group_id);
                            return (
                              <label key={group.group_id} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleGroupMembership(group.group_id)}
                                />
                                <span>{group.group_name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="admin-compact-btn inline-flex items-center gap-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          disabled={processingTagId === tag.id || !editingTagName.trim()}
                          onClick={() => onSaveTagCard(tag.id)}
                        >
                          Tallenna
                        </button>
                        <button
                          type="button"
                          className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
                          onClick={onCancelRenameTag}
                          disabled={processingTagId === tag.id}
                        >
                          Peruuta
                        </button>
                        <button
                          type="button"
                          className={`${isInUse ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'} admin-compact-btn inline-flex items-center gap-1 text-white disabled:opacity-50`}
                          disabled={processingTagId === tag.id}
                          onClick={() => {
                            setPendingDeleteTagId(tag.id);
                            if (!isInUse) {
                              onDeleteReplacementTagIdChange('');
                            }
                          }}
                        >
                          {isInUse ? 'Yhdistä' : 'Poista'}
                        </button>
                      </div>
                      {showDeleteControls && (
                        <div className="rounded border border-orange-200 bg-orange-50 p-2">
                          {isInUse ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-orange-800">
                                Valitse kohdetagi. Tämä tagi yhdistetään siihen ja poistetaan.
                              </p>
                              <select
                                value={deleteReplacementTagId}
                                onChange={(e) => onDeleteReplacementTagIdChange(e.target.value ? Number(e.target.value) : '')}
                                className="max-w-72 rounded-lg border-2 border-gray-300 bg-white px-2 py-1 text-sm focus:border-yellow-400 focus:outline-none"
                              >
                                <option value="">Käytä off-topic tagia</option>
                                {canonicalTags
                                  .filter((candidate) => candidate.id !== tag.id)
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.name}
                                    </option>
                                  ))}
                              </select>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="admin-compact-btn inline-flex items-center gap-1 bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
                                  disabled={processingTagId === tag.id}
                                  onClick={() => {
                                    onDeleteTag(tag, deleteReplacementTagId);
                                    setPendingDeleteTagId(null);
                                  }}
                                >
                                  Yhdistä
                                </button>
                                <button
                                  type="button"
                                  className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  disabled={processingTagId === tag.id}
                                  onClick={() => setPendingDeleteTagId(null)}
                                >
                                  Peruuta
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-red-700">
                                Tagi ei ole käytössä viesteissä. Voit poistaa sen pysyvästi.
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="admin-compact-btn inline-flex items-center gap-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                  disabled={processingTagId === tag.id}
                                  onClick={() => {
                                    onDeleteTag(tag, '');
                                    setPendingDeleteTagId(null);
                                  }}
                                >
                                  Poista tagi
                                </button>
                                <button
                                  type="button"
                                  className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  disabled={processingTagId === tag.id}
                                  onClick={() => setPendingDeleteTagId(null)}
                                >
                                  Peruuta
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500">Vanha nimi/slug lisätään automaattisesti aliakseksi.</p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </Card>
  );
}
