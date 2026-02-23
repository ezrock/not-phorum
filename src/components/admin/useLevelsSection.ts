import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface XpSourceWeight {
  source_key: string;
  label: string;
  weight: number;
  enabled: boolean;
}

export interface LevelRank {
  min_level: number;
  rank_name: string;
}

export interface UserLevelRow {
  profile_id: string;
  username: string;
  display_name: string | null;
  post_count: number;
  topic_count: number;
  like_count: number;
  trophy_points: number;
  honour_points: number;
  login_count: number;
  post_xp: number;
  topic_xp: number;
  like_xp: number;
  trophy_xp: number;
  honour_xp: number;
  login_xp: number;
  total_xp: number;
  level_num: number;
  xp_to_next: number;
  rank_name: string;
}

// Local edit state for a weight row
export type LocalWeights = Record<string, { weight: string; enabled: boolean }>;

export function useLevelsSection(supabase: ReturnType<typeof createClient>) {
  const [weights, setWeights] = useState<XpSourceWeight[]>([]);
  const [ranks, setRanks] = useState<LevelRank[]>([]);
  const [userRows, setUserRows] = useState<UserLevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Weight editing
  const [localWeights, setLocalWeights] = useState<LocalWeights>({});
  const [savingWeightKey, setSavingWeightKey] = useState<string | null>(null);

  // Rank editing
  const [editingRankLevel, setEditingRankLevel] = useState<number | null>(null);
  const [editingRankName, setEditingRankName] = useState('');
  const [newRankLevel, setNewRankLevel] = useState('');
  const [newRankName, setNewRankName] = useState('');
  const [savingRank, setSavingRank] = useState(false);
  const [deletingRankLevel, setDeletingRankLevel] = useState<number | null>(null);

  useEffect(() => {
    void loadConfig();
    void loadOverview();
  }, [supabase]);

  const loadConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_levels_config');
    if (error || !data) {
      setLoading(false);
      return;
    }
    const config = data as { weights: XpSourceWeight[]; ranks: LevelRank[] };
    const ws = config.weights ?? [];
    const rs = config.ranks ?? [];

    setWeights(ws);
    setRanks([...rs].sort((a, b) => a.min_level - b.min_level));

    const local: LocalWeights = {};
    for (const w of ws) {
      local[w.source_key] = { weight: String(w.weight), enabled: w.enabled };
    }
    setLocalWeights(local);
    setLoading(false);
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    const { data } = await supabase.rpc('get_admin_levels_overview');
    if (data) {
      setUserRows(
        (data as UserLevelRow[]).map((row) => ({
          ...row,
          post_count: Number(row.post_count),
          topic_count: Number(row.topic_count),
          like_count: Number(row.like_count),
          trophy_points: Number(row.trophy_points),
          honour_points: Number(row.honour_points),
          post_xp: Number(row.post_xp),
          topic_xp: Number(row.topic_xp),
          like_xp: Number(row.like_xp),
          trophy_xp: Number(row.trophy_xp),
          honour_xp: Number(row.honour_xp),
          login_xp: Number(row.login_xp),
          total_xp: Number(row.total_xp),
        }))
      );
    }
    setOverviewLoading(false);
  };

  const handleSaveWeight = async (sourceKey: string) => {
    setActionError(null);
    const local = localWeights[sourceKey];
    if (!local) return;
    const weightNum = parseFloat(local.weight);
    if (isNaN(weightNum) || weightNum < 0) {
      setActionError('Paino ei voi olla negatiivinen.');
      return;
    }
    setSavingWeightKey(sourceKey);
    const { error } = await supabase.rpc('set_xp_source_weight', {
      p_source_key: sourceKey,
      p_weight: weightNum,
      p_enabled: local.enabled,
    });
    if (error) {
      setActionError(error.message);
    } else {
      setWeights((prev) =>
        prev.map((w) =>
          w.source_key === sourceKey ? { ...w, weight: weightNum, enabled: local.enabled } : w
        )
      );
    }
    setSavingWeightKey(null);
  };

  const beginEditRank = (rank: LevelRank) => {
    setEditingRankLevel(rank.min_level);
    setEditingRankName(rank.rank_name);
    setActionError(null);
  };

  const cancelEditRank = () => {
    setEditingRankLevel(null);
    setEditingRankName('');
  };

  const handleSaveRank = async (minLevel: number, rankName: string) => {
    setActionError(null);
    if (!rankName.trim()) {
      setActionError('Arvonimi ei voi olla tyhjä.');
      return;
    }
    setSavingRank(true);
    const { error } = await supabase.rpc('upsert_level_rank', {
      p_min_level: minLevel,
      p_rank_name: rankName.trim(),
    });
    if (error) {
      setActionError(error.message);
    } else {
      setRanks((prev) => {
        const existing = prev.find((r) => r.min_level === minLevel);
        if (existing) {
          return prev.map((r) =>
            r.min_level === minLevel ? { ...r, rank_name: rankName.trim() } : r
          );
        }
        return [...prev, { min_level: minLevel, rank_name: rankName.trim() }].sort(
          (a, b) => a.min_level - b.min_level
        );
      });
      setEditingRankLevel(null);
      setEditingRankName('');
      setNewRankLevel('');
      setNewRankName('');
    }
    setSavingRank(false);
  };

  const handleDeleteRank = async (minLevel: number) => {
    setActionError(null);
    setDeletingRankLevel(minLevel);
    const { error } = await supabase.rpc('delete_level_rank', { p_min_level: minLevel });
    if (error) {
      setActionError(error.message);
    } else {
      setRanks((prev) => prev.filter((r) => r.min_level !== minLevel));
    }
    setDeletingRankLevel(null);
  };

  const handleAddRank = () => {
    const level = parseInt(newRankLevel, 10);
    if (isNaN(level) || level < 0) {
      setActionError('Taso ei voi olla negatiivinen tai tyhjä.');
      return;
    }
    void handleSaveRank(level, newRankName);
  };

  return {
    // State
    weights,
    ranks,
    userRows,
    loading,
    overviewLoading,
    actionError,
    localWeights,
    setLocalWeights,
    savingWeightKey,
    editingRankLevel,
    editingRankName,
    setEditingRankName,
    newRankLevel,
    setNewRankLevel,
    newRankName,
    setNewRankName,
    savingRank,
    deletingRankLevel,
    // Actions
    handleSaveWeight,
    beginEditRank,
    cancelEditRank,
    handleSaveRank,
    handleDeleteRank,
    handleAddRank,
    loadOverview,
  };
}
