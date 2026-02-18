'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, UserPlus, Trophy, ScrollText, Settings2, Users as UsersIcon, BarChart3, Check, X, Tags as TagsIcon, Star, Plus, Trash2 } from 'lucide-react';
import { trophyLocalIconUrl } from '@/lib/trophies';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/button';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { EventsPanel } from '@/components/admin/EventsPanel';

interface TrophyOverview {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
  source: string;
  awarded_count: number;
}

interface PendingUser {
  id: string;
  username: string;
  created_at: string;
}

interface UnreviewedTag {
  id: number;
  name: string;
  slug: string;
  status: 'unreviewed' | 'approved' | 'rejected' | 'hidden';
  featured: boolean;
  usage_count: number;
  created_at: string;
}

interface CanonicalTagOption {
  id: number;
  name: string;
  slug: string;
}

interface TagAliasRow {
  alias_id: number;
  tag_id: number;
  tag_name: string;
  tag_slug: string;
  alias: string;
  normalized_alias: string;
  created_at: string;
}

type TagModerationAction = 'approve' | 'hide' | 'feature';

type AdminTab = 'board' | 'users' | 'tags' | 'trophies' | 'levels' | 'events';
const SITE_SETTINGS_UPDATED_EVENT = 'site-settings-updated';

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
  const [unreviewedTags, setUnreviewedTags] = useState<UnreviewedTag[]>([]);
  const [canonicalTags, setCanonicalTags] = useState<CanonicalTagOption[]>([]);
  const [tagAliasesByTagId, setTagAliasesByTagId] = useState<Record<number, TagAliasRow[]>>({});
  const [aliasInputByTagId, setAliasInputByTagId] = useState<Record<number, string>>({});
  const [aliasSearch, setAliasSearch] = useState('');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [mergeTargetByTagId, setMergeTargetByTagId] = useState<Record<number, number | ''>>({});
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [processingTagId, setProcessingTagId] = useState<number | null>(null);
  const [processingAliasId, setProcessingAliasId] = useState<number | null>(null);
  const [addingAliasTagId, setAddingAliasTagId] = useState<number | null>(null);
  const [totalAwardedTrophies, setTotalAwardedTrophies] = useState(0);
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;

  const groupAliasesByTagId = (rows: TagAliasRow[]) => {
    return rows.reduce<Record<number, TagAliasRow[]>>((acc, row) => {
      if (!acc[row.tag_id]) {
        acc[row.tag_id] = [];
      }
      acc[row.tag_id].push(row);
      return acc;
    }, {});
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      const [settingsRes, overviewRes, awardedRes, unreviewedTagsRes, canonicalTagsRes, aliasesRes] = await Promise.all([
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
        supabase.rpc('get_unreviewed_tags_with_usage'),
        supabase
          .from('tags')
          .select('id, name, slug')
          .eq('status', 'approved')
          .is('redirect_to_tag_id', null)
          .order('name', { ascending: true }),
        supabase.rpc('get_tag_aliases'),
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
      if (!unreviewedTagsRes.error && unreviewedTagsRes.data) {
        setUnreviewedTags((unreviewedTagsRes.data ?? []) as UnreviewedTag[]);
      }
      if (!canonicalTagsRes.error && canonicalTagsRes.data) {
        setCanonicalTags((canonicalTagsRes.data ?? []) as CanonicalTagOption[]);
      }
      if (!aliasesRes.error && aliasesRes.data) {
        setTagAliasesByTagId(groupAliasesByTagId((aliasesRes.data ?? []) as TagAliasRow[]));
      }
      setTotalAwardedTrophies(awardedRes.count || 0);

      setSettingsLoading(false);
      setTrophyLoading(false);
      setPendingUsersLoading(false);
    };

    fetchAdminData();
  }, [supabase]);

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

  const refreshUnreviewedTags = async () => {
    const { data } = await supabase.rpc('get_unreviewed_tags_with_usage');
    setUnreviewedTags((data ?? []) as UnreviewedTag[]);
  };

  const refreshCanonicalTags = async () => {
    const { data } = await supabase
      .from('tags')
      .select('id, name, slug')
      .eq('status', 'approved')
      .is('redirect_to_tag_id', null)
      .order('name', { ascending: true });

    setCanonicalTags((data ?? []) as CanonicalTagOption[]);
  };

  const refreshTagAliases = async () => {
    const { data } = await supabase.rpc('get_tag_aliases');
    setTagAliasesByTagId(groupAliasesByTagId((data ?? []) as TagAliasRow[]));
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

  const handleModerateTag = async (tagId: number, action: TagModerationAction) => {
    setProcessingTagId(tagId);
    const { error } = await supabase.rpc('moderate_tag', {
      input_tag_id: tagId,
      input_action: action,
    });

    if (!error) {
      await refreshUnreviewedTags();
      await refreshCanonicalTags();
    }
    setProcessingTagId(null);
  };

  const handleMergeTag = async (sourceTagId: number) => {
    const targetTagId = mergeTargetByTagId[sourceTagId];
    if (!targetTagId) return;

    setProcessingTagId(sourceTagId);
    const { error } = await supabase.rpc('merge_tags', {
      source_tag_id: sourceTagId,
      target_tag_id: targetTagId,
    });

    if (!error) {
      await refreshUnreviewedTags();
      await refreshCanonicalTags();
      await refreshTagAliases();
      setMergeTargetByTagId((prev) => ({ ...prev, [sourceTagId]: '' }));
    }

    setProcessingTagId(null);
  };

  const handleAddAlias = async (tagId: number) => {
    const aliasValue = (aliasInputByTagId[tagId] || '').trim();
    if (!aliasValue) return;

    setAddingAliasTagId(tagId);
    const { error } = await supabase.rpc('add_tag_alias', {
      input_tag_id: tagId,
      input_alias: aliasValue,
    });

    if (!error) {
      setAliasInputByTagId((prev) => ({ ...prev, [tagId]: '' }));
      await refreshTagAliases();
    }
    setAddingAliasTagId(null);
  };

  const handleDeleteAlias = async (aliasId: number) => {
    setProcessingAliasId(aliasId);
    const { error } = await supabase.rpc('delete_tag_alias', {
      input_alias_id: aliasId,
    });

    if (!error) {
      await refreshTagAliases();
    }
    setProcessingAliasId(null);
  };

  const beginRenameTag = (tag: CanonicalTagOption) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
  };

  const cancelRenameTag = () => {
    setEditingTagId(null);
    setEditingTagName('');
  };

  const handleRenameTag = async (tagId: number) => {
    const nextName = editingTagName.trim();
    if (!nextName) return;

    setProcessingTagId(tagId);
    const { error } = await supabase.rpc('rename_tag', {
      input_tag_id: tagId,
      input_name: nextName,
    });

    if (!error) {
      await refreshCanonicalTags();
      await refreshTagAliases();
      setEditingTagId(null);
      setEditingTagName('');
    }
    setProcessingTagId(null);
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
        {([
          ['board', 'Boardi'],
          ['events', 'Tapahtumat'],
          ['trophies', 'Pokaalit'],
          ['users', 'Käyttäjät'],
          ['tags', 'Tagit'],
          ['levels', 'Tasot'],
        ] as [AdminTab, string][]).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`page-tab-button ${activeTab === value ? 'is-active' : ''}`}
          >
            {label}
          </button>
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
        <Card>
          <h2 className="card-title flex items-center gap-2">
            {showHeaderIcons && <UsersIcon size={20} className="text-yellow-600" />}
            Käyttäjät
          </h2>
          {pendingUsers.length === 0 ? (
            <p className="text-sm text-gray-500">Ei uusia hyväksyntää odottavia käyttäjiä.</p>
          ) : (
            <div className="space-y-2">
              {pendingUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{user.username}</p>
                    <p className="text-xs text-gray-500">{new Date(user.created_at).toLocaleString('fi-FI')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={processingUserId === user.id}
                      onClick={() => handleSetApprovalStatus(user.id, 'approved')}
                      className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={processingUserId === user.id}
                      onClick={() => handleSetApprovalStatus(user.id, 'rejected')}
                      className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'tags' && (
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
                      onClick={() => handleModerateTag(tag.id, 'approve')}
                      className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={processingTagId === tag.id}
                      onClick={() => handleModerateTag(tag.id, 'feature')}
                      className="inline-flex items-center gap-1 rounded bg-yellow-500 px-2 py-1 text-xs font-semibold text-white hover:bg-yellow-600 disabled:opacity-50"
                    >
                      <Star size={14} />
                      Feature
                    </button>
                    <button
                      type="button"
                      disabled={processingTagId === tag.id}
                      onClick={() => handleModerateTag(tag.id, 'hide')}
                      className="inline-flex items-center gap-1 rounded bg-gray-700 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      <X size={14} />
                      Hide
                    </button>
                    <select
                      value={mergeTargetByTagId[tag.id] ?? ''}
                      onChange={(e) =>
                        setMergeTargetByTagId((prev) => ({
                          ...prev,
                          [tag.id]: e.target.value ? Number(e.target.value) : '',
                        }))
                      }
                      className="max-w-48 rounded border border-gray-300 bg-white px-2 py-1 text-xs"
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
                      onClick={() => handleMergeTag(tag.id)}
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
            <div className="mb-3">
              <Input
                value={aliasSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAliasSearch(e.target.value)}
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
                            <div className="flex items-center gap-2">
                              <input
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                className="w-full max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
                                placeholder="Tagin nimi"
                              />
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                disabled={processingTagId === tag.id || !editingTagName.trim()}
                                onClick={() => handleRenameTag(tag.id)}
                              >
                                Tallenna
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                                onClick={cancelRenameTag}
                                disabled={processingTagId === tag.id}
                              >
                                Peruuta
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">#{tag.name}</p>
                              <button
                                type="button"
                                className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-200"
                                onClick={() => beginRenameTag(tag)}
                              >
                                Muokkaa nimeä
                              </button>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 truncate">{tag.slug}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {aliases.length === 0 ? (
                              <span className="text-xs text-gray-400">Ei aliaksia</span>
                            ) : (
                              aliases.map((aliasRow) => (
                                <span
                                  key={aliasRow.alias_id}
                                  className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-900"
                                >
                                  {aliasRow.alias}
                                  <button
                                    type="button"
                                    className="rounded p-0.5 hover:bg-blue-100"
                                    onClick={() => handleDeleteAlias(aliasRow.alias_id)}
                                    disabled={processingAliasId === aliasRow.alias_id}
                                    aria-label={`Poista alias ${aliasRow.alias}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex w-full max-w-xs items-center gap-2">
                          <input
                            value={aliasInputByTagId[tag.id] || ''}
                            onChange={(e) =>
                              setAliasInputByTagId((prev) => ({ ...prev, [tag.id]: e.target.value }))
                            }
                            placeholder="Lisää alias..."
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                            disabled={addingAliasTagId === tag.id || !(aliasInputByTagId[tag.id] || '').trim()}
                            onClick={() => handleAddAlias(tag.id)}
                          >
                            <Plus size={12} />
                            Lisää
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
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
