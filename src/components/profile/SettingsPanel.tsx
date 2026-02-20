'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { Settings2, RefreshCw, EyeOff } from 'lucide-react';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { TokenInput, type TokenItem, type TokenOption } from '@/components/ui/TokenInput';

interface SettingsPanelProps {
  initialRealtimeEnabled: boolean;
  initialHiddenTagIds: number[];
  initialHiddenTagGroupIds: number[];
}

interface TagHit {
  id: number;
  name: string;
  slug: string;
  icon?: string;
}

interface TagGroupHit {
  group_id: number;
  group_name: string;
  group_slug: string;
  member_count: number;
}

interface HiddenImpactRow {
  hidden_topic_count: number;
  total_topic_count: number;
  hidden_message_count: number;
  total_message_count: number;
  hidden_message_percent: number;
}

function normalizeIds(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (err && typeof err === 'object') {
    const maybeMessage = (err as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) return maybeMessage;
  }
  return fallback;
}

function parseImpactRow(data: unknown): HiddenImpactRow | null {
  const row = Array.isArray(data)
    ? (data[0] as Record<string, unknown> | undefined)
    : (data as Record<string, unknown> | null);
  if (!row || typeof row !== 'object') return null;
  return {
    hidden_topic_count: Number(row.hidden_topic_count ?? 0),
    total_topic_count: Number(row.total_topic_count ?? 0),
    hidden_message_count: Number(row.hidden_message_count ?? 0),
    total_message_count: Number(row.total_message_count ?? 0),
    hidden_message_percent: Number(row.hidden_message_percent ?? 0),
  };
}

export function SettingsPanel({
  initialRealtimeEnabled,
  initialHiddenTagIds,
  initialHiddenTagGroupIds,
}: SettingsPanelProps) {
  const { currentUser, supabase, refreshProfile } = useAuth();
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;
  const showSettingActionIcons = UI_ICON_SETTINGS.showSettingActionIcons;
  const showSectionHeaderIcons = UI_ICON_SETTINGS.showSectionHeaderIcons;

  const [realtimeUpdatesEnabled, setRealtimeUpdatesEnabled] = useState(initialRealtimeEnabled);
  const [hiddenTagIds, setHiddenTagIds] = useState(() => normalizeIds(initialHiddenTagIds));
  const [hiddenTagGroupIds, setHiddenTagGroupIds] = useState(() => normalizeIds(initialHiddenTagGroupIds));
  const [hiddenTagById, setHiddenTagById] = useState<Record<number, TagHit>>({});
  const [hiddenGroupById, setHiddenGroupById] = useState<Record<number, TagGroupHit>>({});

  const [hideQuery, setHideQuery] = useState('');
  const [hideOptions, setHideOptions] = useState<TokenOption[]>([]);
  const [loadingHideOptions, setLoadingHideOptions] = useState(false);
  const [hiddenImpact, setHiddenImpact] = useState<HiddenImpactRow | null>(null);
  const [loadingHiddenImpact, setLoadingHiddenImpact] = useState(false);
  const [hiddenImpactError, setHiddenImpactError] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingHiddenFilters, setSavingHiddenFilters] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const saveHiddenFilters = async (nextTagIds: number[], nextGroupIds: number[]) => {
    if (!currentUser) return;

    const normalizedTagIds = normalizeIds(nextTagIds);
    const normalizedGroupIds = normalizeIds(nextGroupIds);

    setSavingHiddenFilters(true);
    setSettingsError('');
    setSettingsSuccess('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          hidden_tag_ids: normalizedTagIds,
          hidden_tag_group_ids: normalizedGroupIds,
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setHiddenTagIds(normalizedTagIds);
      setHiddenTagGroupIds(normalizedGroupIds);
      await refreshProfile();
      setSettingsSuccess('Asetukset tallennettu!');
    } catch (err: unknown) {
      setSettingsError(toErrorMessage(err, 'Asetusten tallennus epäonnistui'));
    } finally {
      setSavingHiddenFilters(false);
    }
  };

  const handleRealtimeToggle = async (nextValue: boolean) => {
    if (!currentUser) return;

    setSettingsError('');
    setSettingsSuccess('');
    setRealtimeUpdatesEnabled(nextValue);
    setSavingSettings(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ realtime_updates_enabled: nextValue })
        .eq('id', currentUser.id);

      if (error) throw error;

      await refreshProfile();
      setSettingsSuccess('Asetukset tallennettu!');
    } catch (err: unknown) {
      setRealtimeUpdatesEnabled((prev) => !prev);
      setSettingsError(toErrorMessage(err, 'Asetusten tallennus epäonnistui'));
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    const hydrateSelectedLabels = async () => {
      if (hiddenTagIds.length > 0) {
        const params = new URLSearchParams();
        params.set('status', 'approved');
        params.set('ids', hiddenTagIds.join(','));
        params.set('limit', String(Math.max(20, hiddenTagIds.length + 5)));

        const tagRes = await fetch(`/api/tags?${params.toString()}`, { cache: 'no-store' });
        if (tagRes.ok) {
          const payload = (await tagRes.json()) as { tags?: TagHit[] };
          const next: Record<number, TagHit> = {};
          for (const tag of payload.tags || []) {
            next[tag.id] = tag;
          }
          setHiddenTagById((prev) => ({ ...prev, ...next }));
        }
      }

      if (hiddenTagGroupIds.length > 0) {
        const { data } = await supabase.rpc('get_tag_groups_with_members');
        if (Array.isArray(data)) {
          const next: Record<number, TagGroupHit> = {};
          for (const row of data as Record<string, unknown>[]) {
            const id = Number(row.group_id);
            if (!hiddenTagGroupIds.includes(id)) continue;
            next[id] = {
              group_id: id,
              group_name: String(row.group_name ?? ''),
              group_slug: String(row.group_slug ?? ''),
              member_count: Number(row.member_count ?? 0),
            };
          }
          setHiddenGroupById((prev) => ({ ...prev, ...next }));
        }
      }
    };

    void hydrateSelectedLabels();
  }, [hiddenTagIds, hiddenTagGroupIds, supabase]);

  useEffect(() => {
    const query = hideQuery.trim();
    const timer = window.setTimeout(async () => {
      if (!query) {
        setHideOptions([]);
        return;
      }

      setLoadingHideOptions(true);
      try {
        const [tagRes, groupRes] = await Promise.all([
          fetch(`/api/tags?status=approved&query=${encodeURIComponent(query)}&limit=10`, { cache: 'no-store' }),
          supabase.rpc('search_tag_groups', {
            input_query: query,
            input_limit: 8,
          }),
        ]);

        const options: TokenOption[] = [];

        if (tagRes.ok) {
          const payload = (await tagRes.json()) as { tags?: TagHit[] };
          for (const tag of payload.tags || []) {
            if (hiddenTagIds.includes(tag.id)) continue;
            options.push({
              id: `tag:${tag.id}`,
              label: tag.name,
              icon: tag.icon || '🏷️',
            });
          }
        }

        if (Array.isArray(groupRes.data)) {
          for (const row of groupRes.data as Record<string, unknown>[]) {
            const groupId = Number(row.group_id);
            if (!Number.isFinite(groupId) || groupId <= 0) continue;
            if (hiddenTagGroupIds.includes(groupId)) continue;
            options.push({
              id: `group:${groupId}`,
              label: String(row.group_name ?? ''),
              icon: '📚',
              meta: `${Number(row.member_count ?? 0)} aihetta`,
            });
          }
        }

        setHideOptions(options);
      } finally {
        setLoadingHideOptions(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [hideQuery, hiddenTagIds, hiddenTagGroupIds, supabase]);

  useEffect(() => {
    const fetchImpact = async () => {
      setLoadingHiddenImpact(true);
      setHiddenImpactError('');
      try {
        const { data, error } = await supabase.rpc('get_hidden_topic_filter_impact', {
          input_hidden_tag_ids: hiddenTagIds,
          input_hidden_tag_group_ids: hiddenTagGroupIds,
        });
        if (!error) {
          const parsed = parseImpactRow(data);
          if (parsed) {
            setHiddenImpact(parsed);
            return;
          }
        }

        const { data: canonicalDirectData, error: canonicalDirectError } = await supabase.rpc('resolve_canonical_tag_ids', {
          input_tag_ids: hiddenTagIds,
        });
        if (canonicalDirectError) throw canonicalDirectError;

        let groupMemberIds: number[] = [];
        if (hiddenTagGroupIds.length > 0) {
          const { data: membersData, error: membersError } = await supabase
            .from('tag_group_members')
            .select('tag_id')
            .in('group_id', hiddenTagGroupIds);
          if (membersError) throw membersError;
          groupMemberIds = (membersData || [])
            .map((row) => Number(row.tag_id))
            .filter((value) => Number.isFinite(value) && value > 0);
        }

        const { data: canonicalGroupData, error: canonicalGroupError } = await supabase.rpc('resolve_canonical_tag_ids', {
          input_tag_ids: groupMemberIds,
        });
        if (canonicalGroupError) throw canonicalGroupError;

        const excludedTagIds = Array.from(
          new Set([
            ...(Array.isArray(canonicalDirectData) ? canonicalDirectData : []),
            ...(Array.isArray(canonicalGroupData) ? canonicalGroupData : []),
          ])
        )
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0);

        const { count: totalTopicCount, error: totalTopicError } = await supabase
          .from('topics')
          .select('id', { count: 'exact', head: true });
        if (totalTopicError) throw totalTopicError;

        const { count: totalMessageCount, error: totalMessageError } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null);
        if (totalMessageError) throw totalMessageError;

        if (excludedTagIds.length === 0) {
          setHiddenImpact({
            hidden_topic_count: 0,
            total_topic_count: totalTopicCount || 0,
            hidden_message_count: 0,
            total_message_count: totalMessageCount || 0,
            hidden_message_percent: 0,
          });
          return;
        }

        const { data: topicTagRows, error: topicTagError } = await supabase
          .from('topic_tags')
          .select('topic_id')
          .in('tag_id', excludedTagIds);
        if (topicTagError) throw topicTagError;

        const hiddenTopicIds = Array.from(
          new Set(
            (topicTagRows || [])
              .map((row) => Number(row.topic_id))
              .filter((value) => Number.isFinite(value) && value > 0)
          )
        );

        let hiddenMessageCount = 0;
        if (hiddenTopicIds.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < hiddenTopicIds.length; i += chunkSize) {
            const chunk = hiddenTopicIds.slice(i, i + chunkSize);
            const { count: chunkCount, error: chunkError } = await supabase
              .from('posts')
              .select('id', { count: 'exact', head: true })
              .in('topic_id', chunk)
              .is('deleted_at', null);
            if (chunkError) throw chunkError;
            hiddenMessageCount += chunkCount || 0;
          }
        }

        const safeTotalMessageCount = totalMessageCount || 0;
        const hiddenPercent = safeTotalMessageCount > 0
          ? Number(((hiddenMessageCount / safeTotalMessageCount) * 100).toFixed(1))
          : 0;

        setHiddenImpact({
          hidden_topic_count: hiddenTopicIds.length,
          total_topic_count: totalTopicCount || 0,
          hidden_message_count: hiddenMessageCount,
          total_message_count: safeTotalMessageCount,
          hidden_message_percent: hiddenPercent,
        });
      } catch (err: unknown) {
        setHiddenImpactError(toErrorMessage(err, 'Piilotusvaikutuksen laskenta epäonnistui'));
        setHiddenImpact({
          hidden_topic_count: 0,
          total_topic_count: 0,
          hidden_message_count: 0,
          total_message_count: 0,
          hidden_message_percent: 0,
        });
      } finally {
        setLoadingHiddenImpact(false);
      }
    };

    void fetchImpact();
  }, [hiddenTagIds, hiddenTagGroupIds, supabase]);

  const hiddenTokens = useMemo<TokenItem[]>(() => {
    const tagTokens = hiddenTagIds.map((tagId) => {
      const tag = hiddenTagById[tagId];
      return {
        id: `tag:${tagId}`,
        label: tag?.name || `Tagi #${tagId}`,
        icon: tag?.icon || '🏷️',
      };
    });

    const groupTokens = hiddenTagGroupIds.map((groupId) => {
      const group = hiddenGroupById[groupId];
      return {
        id: `group:${groupId}`,
        label: group?.group_name || `Ryhmä #${groupId}`,
        icon: '📚',
      };
    });

    return [...tagTokens, ...groupTokens];
  }, [hiddenTagById, hiddenGroupById, hiddenTagGroupIds, hiddenTagIds]);

  const handleSelectHiddenOption = (option: TokenOption) => {
    const [kind, rawId] = String(option.id).split(':');
    const id = Number.parseInt(rawId, 10);
    if (!Number.isFinite(id) || id <= 0) return;

    setSettingsError('');
    setSettingsSuccess('');
    setHideQuery('');

    if (kind === 'tag') {
      void saveHiddenFilters([...hiddenTagIds, id], hiddenTagGroupIds);
      return;
    }

    if (kind === 'group') {
      void saveHiddenFilters(hiddenTagIds, [...hiddenTagGroupIds, id]);
    }
  };

  const handleRemoveHiddenToken = (id: number | string) => {
    const [kind, rawId] = String(id).split(':');
    const numericId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) return;

    setSettingsError('');
    setSettingsSuccess('');

    if (kind === 'tag') {
      void saveHiddenFilters(hiddenTagIds.filter((tagId) => tagId !== numericId), hiddenTagGroupIds);
      return;
    }

    if (kind === 'group') {
      void saveHiddenFilters(hiddenTagIds, hiddenTagGroupIds.filter((groupId) => groupId !== numericId));
    }
  };

  return (
    <Card className="mb-6">
      <h2 className="card-title flex items-center gap-2">
        {showHeaderIcons && <Settings2 size={20} className="text-yellow-600" />}
        Asetukset
      </h2>

      {settingsError && <Alert variant="error">{settingsError}</Alert>}
      {settingsSuccess && <Alert variant="success">{settingsSuccess}</Alert>}

      <div>

      <section className="section-block">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {showSettingActionIcons && <RefreshCw size={20} className="text-gray-600" />}
              <div>
                <p className="font-medium">Reaaliaikaiset päivitykset</p>
                <p className="text-sm text-gray-500">
                  {realtimeUpdatesEnabled
                    ? 'Ketjut ja viestit päivittyvät automaattisesti'
                    : 'Päivitykset vain sivun latauksella'}
                </p>
              </div>
            </div>
            <button
              id="realtimeUpdatesEnabled"
              type="button"
              role="switch"
              aria-checked={realtimeUpdatesEnabled}
              aria-label="Reaaliaikaiset päivitykset ketjuille ja viesteille"
              disabled={savingSettings}
              onClick={() => handleRealtimeToggle(!realtimeUpdatesEnabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                realtimeUpdatesEnabled ? 'bg-green-500' : 'bg-gray-300'
              } ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  realtimeUpdatesEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>

        <section className="section-block">
          <h3 className="section-header">
            {showSectionHeaderIcons && <EyeOff size={16} className="text-yellow-600" />}
            Piilotetut aiheet
          </h3>

          <p className="mb-3 text-sm text-gray-500">
            Valitse tagit tai tagiryhmät, joiden aiheet haluat piilottaa foorumin listauksesta.
          </p>

          <TokenInput
            label="Piilota tagit / ryhmät"
            placeholder="Hae tageja tai ryhmiä..."
            tokens={hiddenTokens}
            query={hideQuery}
            onQueryChange={setHideQuery}
            onRemoveToken={handleRemoveHiddenToken}
            options={hideOptions}
            onSelectOption={handleSelectHiddenOption}
            loading={loadingHideOptions || savingHiddenFilters}
            emptyMessage="Ei osumia"
            disabled={savingHiddenFilters}
          />

          <p className="mt-3 text-xs text-gray-500">
            {loadingHiddenImpact && 'Lasketaan piilotusvaikutusta...'}
            {!loadingHiddenImpact && hiddenImpact && (
              <>
                {hiddenImpact.hidden_topic_count} ketjua piilossa ({hiddenImpact.hidden_message_percent.toFixed(1)} % kaikista viesteistä).
              </>
            )}
            {!loadingHiddenImpact && hiddenImpactError && ` ${hiddenImpactError}`}
          </p>
        </section>

      
      </div>
    </Card>
  );
}
