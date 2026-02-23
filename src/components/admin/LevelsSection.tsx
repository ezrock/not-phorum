'use client';

import { BarChart3, Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { useLevelsSection } from '@/components/admin/useLevelsSection';
import type { LevelRank } from '@/components/admin/useLevelsSection';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── Sub-component: source weights table ───────────────────────────────────

interface WeightsCardProps {
  state: ReturnType<typeof useLevelsSection>;
}

function WeightsCard({ state }: WeightsCardProps) {
  const { weights, localWeights, setLocalWeights, savingWeightKey, handleSaveWeight } = state;
  const showIcons = UI_ICON_SETTINGS.showHeaderIcons;

  return (
    <Card>
      <h2 className="card-title flex items-center gap-2">
        {showIcons && <BarChart3 size={20} className="text-yellow-600" />}
        Pisteytyspainot
      </h2>
      <p className="text-muted-sm mb-4">
        Kuinka monta XP-pistettä kukin toiminto antaa. Kokonais-XP = viestit × paino + ketjut × paino
        + … Taso = ⌊√XP⌋.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-2 pr-4 font-medium">Lähde</th>
              <th className="pb-2 pr-4 font-medium">Paino</th>
              <th className="pb-2 pr-4 font-medium">Käytössä</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {weights.map((w) => {
              const local = localWeights[w.source_key];
              const isSaving = savingWeightKey === w.source_key;
              if (!local) return null;
              return (
                <tr key={w.source_key} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-medium text-gray-700">{w.label}</td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={local.weight}
                      onChange={(e) =>
                        setLocalWeights((prev) => ({
                          ...prev,
                          [w.source_key]: { ...prev[w.source_key], weight: e.target.value },
                        }))
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      checked={local.enabled}
                      onChange={(e) =>
                        setLocalWeights((prev) => ({
                          ...prev,
                          [w.source_key]: { ...prev[w.source_key], enabled: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded accent-yellow-500"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveWeight(w.source_key)}
                      className="admin-compact-btn inline-flex items-center gap-1 bg-gray-700 text-white hover:bg-gray-900 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Check size={12} />
                      )}
                      Tallenna
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Sub-component: rank names table ───────────────────────────────────────

interface RanksCardProps {
  state: ReturnType<typeof useLevelsSection>;
}

function RanksCard({ state }: RanksCardProps) {
  const {
    ranks,
    editingRankLevel,
    editingRankName,
    setEditingRankName,
    newRankLevel,
    setNewRankLevel,
    newRankName,
    setNewRankName,
    savingRank,
    deletingRankLevel,
    beginEditRank,
    cancelEditRank,
    handleSaveRank,
    handleDeleteRank,
    handleAddRank,
  } = state;

  const renderRow = (rank: LevelRank) => {
    const isEditing = editingRankLevel === rank.min_level;
    const isDeleting = deletingRankLevel === rank.min_level;
    const isBase = rank.min_level === 0;

    if (isEditing) {
      return (
        <tr key={rank.min_level} className="border-b border-gray-100 bg-yellow-50">
          <td className="py-2 pr-4 font-mono text-gray-500">{rank.min_level}</td>
          <td className="py-2 pr-4">
            <input
              type="text"
              value={editingRankName}
              onChange={(e) => setEditingRankName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRank(rank.min_level, editingRankName);
                if (e.key === 'Escape') cancelEditRank();
              }}
              autoFocus
              className="w-full rounded border border-yellow-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </td>
          <td className="py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={savingRank}
                onClick={() => handleSaveRank(rank.min_level, editingRankName)}
                className="admin-compact-btn inline-flex items-center gap-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={cancelEditRank}
                className="admin-compact-btn inline-flex items-center gap-1 bg-gray-400 text-white hover:bg-gray-500"
              >
                <X size={12} />
              </button>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <tr key={rank.min_level} className="border-b border-gray-100 last:border-0">
        <td className="py-2 pr-4 font-mono text-gray-500">≥ {rank.min_level}</td>
        <td className="py-2 pr-4 text-gray-800">{rank.rank_name}</td>
        <td className="py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => beginEditRank(rank)}
              className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              <Pencil size={12} />
            </button>
            {!isBase && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteRank(rank.min_level)}
                className="admin-compact-btn inline-flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <Card>
      <h2 className="card-title">Tasonimet</h2>
      <p className="text-muted-sm mb-4">
        Arvonimi määräytyy korkeimman täyttyneen kynnystason mukaan.
      </p>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="pb-2 pr-4 w-24 font-medium">Min. taso</th>
              <th className="pb-2 pr-4 font-medium">Arvonimi</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>{ranks.map(renderRow)}</tbody>
        </table>
      </div>

      {/* Add new rank row */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
        <input
          type="number"
          min="1"
          placeholder="Taso"
          value={newRankLevel}
          onChange={(e) => setNewRankLevel(e.target.value)}
          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
        />
        <input
          type="text"
          placeholder="Uusi arvonimi"
          value={newRankName}
          onChange={(e) => setNewRankName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddRank();
          }}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400"
        />
        <button
          type="button"
          disabled={savingRank || !newRankLevel || !newRankName}
          onClick={handleAddRank}
          className="admin-compact-btn inline-flex items-center gap-1 bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50"
        >
          {savingRank ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
          Lisää
        </button>
      </div>
    </Card>
  );
}

// ── Sub-component: user levels overview table ─────────────────────────────

interface UsersCardProps {
  state: ReturnType<typeof useLevelsSection>;
}

function UsersCard({ state }: UsersCardProps) {
  const { userRows, overviewLoading, loadOverview } = state;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="card-title">Käyttäjätasot</h2>
        <button
          type="button"
          disabled={overviewLoading}
          onClick={loadOverview}
          className="admin-compact-btn inline-flex items-center gap-1 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
        >
          <RefreshCw size={12} className={overviewLoading ? 'animate-spin' : ''} />
          Päivitä
        </button>
      </div>

      {overviewLoading ? (
        <p className="text-muted-sm">Lasketaan...</p>
      ) : userRows.length === 0 ? (
        <p className="text-muted-sm">Ei käyttäjiä.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">Käyttäjä</th>
                <th className="pb-2 pr-4 font-medium text-right">Taso</th>
                <th className="pb-2 pr-4 font-medium">Arvonimi</th>
                <th className="pb-2 pr-4 font-medium text-right">Yhteensä</th>
                <th className="pb-2 pr-4 font-medium text-right">Seuraavaan</th>
                <th className="pb-2 pr-4 font-medium text-right">Viestit</th>
                <th className="pb-2 pr-4 font-medium text-right">Ketjut</th>
                <th className="pb-2 pr-4 font-medium text-right">Tykkäykset</th>
                <th className="pb-2 pr-4 font-medium text-right">Pokaalit</th>
                <th className="pb-2 pr-4 font-medium text-right">Kunniapisteet</th>
                <th className="pb-2 font-medium text-right">Kirjautumiset</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((row, i) => (
                <tr
                  key={row.profile_id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="py-1.5 pr-4 text-gray-400">{i + 1}</td>
                  <td className="py-1.5 pr-4 font-medium text-gray-800">
                    {row.username}
                    {row.display_name && row.display_name !== row.username && (
                      <span className="text-muted-xs ml-1">({row.display_name})</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono font-bold text-yellow-700">
                    {row.level_num}
                  </td>
                  <td className="py-1.5 pr-4 text-gray-600 italic">{row.rank_name}</td>
                  <td className="py-1.5 pr-4 text-right font-mono">{fmt(row.total_xp)}</td>
                  <td className="py-1.5 pr-4 text-right font-mono text-gray-400">
                    +{row.xp_to_next}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-gray-600">
                    {row.post_count > 0 ? (
                      <>
                        {row.post_count}
                        {row.post_xp !== row.post_count && (
                          <span className="text-gray-400"> ({fmt(row.post_xp)})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-gray-600">
                    {row.topic_count > 0 ? (
                      <>
                        {row.topic_count}
                        {row.topic_xp !== row.topic_count * 2 && (
                          <span className="text-gray-400"> ({fmt(row.topic_xp)})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-gray-600">
                    {row.like_count > 0 ? (
                      <>
                        {row.like_count}
                        {row.like_xp !== row.like_count && (
                          <span className="text-gray-400"> ({fmt(row.like_xp)})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-gray-600">
                    {row.trophy_points > 0 ? (
                      <>
                        {row.trophy_points}
                        {row.trophy_xp !== row.trophy_points && (
                          <span className="text-gray-400"> ({fmt(row.trophy_xp)})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-4 text-right font-mono text-gray-600">
                    {row.honour_points > 0 ? (
                      <>
                        {row.honour_points}
                        {row.honour_xp !== row.honour_points && (
                          <span className="text-gray-400"> ({fmt(row.honour_xp)})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-600">
                    {row.login_count > 0 ? (
                      <>
                        {row.login_count}
                        {row.login_xp !== row.login_count && (
                          <span className="text-gray-400"> ({fmt(row.login_xp)})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LevelsSection() {
  const { supabase } = useAuth();
  const state = useLevelsSection(supabase);

  if (state.loading) {
    return (
      <Card>
        <p className="text-muted-sm">Ladataan tasokonfiguraatiota...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {state.actionError && (
        <Alert type="error" message={state.actionError} />
      )}
      <WeightsCard state={state} />
      <RanksCard state={state} />
      <UsersCard state={state} />
    </div>
  );
}
