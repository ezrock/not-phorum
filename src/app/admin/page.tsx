'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, UserPlus, Trophy, ScrollText, Settings2, Users as UsersIcon, FolderTree, BarChart3 } from 'lucide-react';
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

type AdminTab = 'board' | 'users' | 'categories' | 'trophies' | 'levels' | 'events';
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
  const [trophyOverview, setTrophyOverview] = useState<TrophyOverview[]>([]);
  const [totalAwardedTrophies, setTotalAwardedTrophies] = useState(0);
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;

  useEffect(() => {
    const fetchAdminData = async () => {
      const [settingsRes, overviewRes, awardedRes] = await Promise.all([
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
      ]);

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
      setTotalAwardedTrophies(awardedRes.count || 0);

      setSettingsLoading(false);
      setTrophyLoading(false);
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

  if (loading || settingsLoading || trophyLoading) {
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
          ['categories', 'Kategoriat'],
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
          <p className="text-sm text-gray-500">Käyttäjähallinta tulossa tähän korttiin.</p>
        </Card>
      )}

      {activeTab === 'categories' && (
        <Card>
          <h2 className="card-title flex items-center gap-2">
            {showHeaderIcons && <FolderTree size={20} className="text-yellow-600" />}
            Kategoriat
          </h2>
          <p className="text-sm text-gray-500">Kategoriahallinta tulossa tähän korttiin.</p>
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
