import { Check, Star, Tags as TagsIcon, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AdminActionError } from '@/components/admin/AdminActionError';
import { AliasManager } from '@/components/admin/AliasManager';
import type { CanonicalTagOption, TagAliasRow, TagModerationAction, UnreviewedTag } from '@/components/admin/types';

interface TagsSectionProps {
  showHeaderIcons: boolean;
  unreviewedTags: UnreviewedTag[];
  canonicalTags: CanonicalTagOption[];
  mergeTargetByTagId: Record<number, number | ''>;
  processingTagId: number | null;
  tagActionError: string;
  aliasSearch: string;
  editingTagId: number | null;
  editingTagName: string;
  editingTagSlug: string;
  aliasInputByTagId: Record<number, string>;
  tagAliasesByTagId: Record<number, TagAliasRow[]>;
  addingAliasTagId: number | null;
  processingAliasId: number | null;
  onModerateTag: (tagId: number, action: TagModerationAction) => void;
  onMergeTargetChange: (tagId: number, target: number | '') => void;
  onMergeTag: (sourceTagId: number) => void;
  onAliasSearchChange: (value: string) => void;
  onBeginRenameTag: (tag: CanonicalTagOption) => void;
  onCancelRenameTag: () => void;
  onEditingTagNameChange: (value: string) => void;
  onEditingTagSlugChange: (value: string) => void;
  onRenameTag: (tagId: number) => void;
  onAliasInputChange: (tagId: number, value: string) => void;
  onAddAlias: (tagId: number, value: string) => void;
  onDeleteAlias: (aliasId: number) => void;
  onDeleteTag: (tag: CanonicalTagOption) => void;
}

export function TagsSection({
  showHeaderIcons,
  unreviewedTags,
  canonicalTags,
  mergeTargetByTagId,
  processingTagId,
  tagActionError,
  aliasSearch,
  editingTagId,
  editingTagName,
  editingTagSlug,
  aliasInputByTagId,
  tagAliasesByTagId,
  addingAliasTagId,
  processingAliasId,
  onModerateTag,
  onMergeTargetChange,
  onMergeTag,
  onAliasSearchChange,
  onBeginRenameTag,
  onCancelRenameTag,
  onEditingTagNameChange,
  onEditingTagSlugChange,
  onRenameTag,
  onAliasInputChange,
  onAddAlias,
  onDeleteAlias,
  onDeleteTag,
}: TagsSectionProps) {
  return (
    <Card>
      <h2 className="card-title flex items-center gap-2">
        {showHeaderIcons && <TagsIcon size={20} className="text-yellow-600" />}
        Tagit
      </h2>
      <div className="mb-3 space-y-2 text-sm text-gray-600">
        <p>
          Tagit kuvaavat keskustelun aihetta. Uudet keskustelut ovat tagipohjaisia, ja sama keskustelu voi sisältää useita tageja.
        </p>
        <p>
          Alla näkyvät käsittelemättömät (`unreviewed`) tagit käyttömäärän mukaan järjestettynä: eniten käytetyt ensin.
        </p>
      </div>
      <div className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 space-y-1">
        <p><strong>Approve</strong>: hyväksyy tagin käyttöön (`approved`).</p>
        <p><strong>Feature</strong>: hyväksyy tagin ja nostaa sen esiin autocompleteen (`approved + featured`).</p>
        <p><strong>Hide</strong>: piilottaa tagin (`hidden`), eikä sitä näytetä uusissa valinnoissa.</p>
        <p><strong>Merge</strong>: yhdistää tagin valittuun canonical-tagiiin; viittaukset siirtyvät kohteeseen ja vanha tagi muuttuu aliasiksi (`hidden + redirect`).</p>
      </div>

      {unreviewedTags.length === 0 ? (
        <p className="text-sm text-gray-500">Ei käsittelemättömiä tageja.</p>
      ) : (
        <div className="space-y-2">
          {unreviewedTags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium truncate">#{tag.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {tag.slug} • {tag.usage_count} käyttöä • {new Date(tag.created_at).toLocaleString('fi-FI')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={processingTagId === tag.id}
                  onClick={() => onModerateTag(tag.id, 'approve')}
                  className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={processingTagId === tag.id}
                  onClick={() => onModerateTag(tag.id, 'feature')}
                  className="inline-flex items-center gap-1 rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                >
                  <Star size={14} />
                  Feature
                </button>
                <button
                  type="button"
                  disabled={processingTagId === tag.id}
                  onClick={() => onModerateTag(tag.id, 'hide')}
                  className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
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
                        #{candidate.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={processingTagId === tag.id || !mergeTargetByTagId[tag.id]}
                  onClick={() => onMergeTag(tag.id)}
                  className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Merge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="font-semibold text-gray-800 mb-2">Canonical tagit ja aliakset</h3>
        <p className="text-xs text-gray-500 mb-3">
          Aliakset toimivat hakusynonyymeinä (esim. &quot;pleikka&quot; -&gt; PlayStation 5). Merge siirtää aliasit myös kohdetagille.
        </p>
        <AdminActionError message={tagActionError} className="mb-3" />
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
              const isEditing = editingTagId === tag.id;
              return (
                <div key={tag.id} className="rounded border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="block w-full max-w-xs text-xs text-gray-600">
                              Tagin nimi
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
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                              disabled={processingTagId === tag.id || !editingTagName.trim()}
                              onClick={() => onRenameTag(tag.id)}
                            >
                              Tallenna
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                              onClick={onCancelRenameTag}
                              disabled={processingTagId === tag.id}
                            >
                              Peruuta
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">Vanha nimi/slug lisätään automaattisesti aliakseksi.</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">#{tag.name}</p>
                          <button
                            type="button"
                            className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-200"
                            onClick={() => onBeginRenameTag(tag)}
                          >
                            Muokkaa nimeä
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {tag.slug} • käyttö: {tag.usage_count} • aliasit: {tag.alias_count} • ryhmät: {tag.group_membership_count}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
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
                    <div className="mt-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        disabled={
                          processingTagId === tag.id
                          || tag.usage_count > 0
                          || tag.alias_count > 0
                          || tag.group_membership_count > 0
                          || tag.redirect_reference_count > 0
                        }
                        onClick={() => onDeleteTag(tag)}
                        title={
                          tag.usage_count > 0
                          || tag.alias_count > 0
                          || tag.group_membership_count > 0
                          || tag.redirect_reference_count > 0
                            ? 'Tagia ei voi poistaa, koska se on käytössä'
                            : 'Poista tagi'
                        }
                      >
                        Poista tagi
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </Card>
  );
}
