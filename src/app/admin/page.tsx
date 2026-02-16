'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, UserPlus, Trophy } from 'lucide-react';

interface TrophyOverview {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
  source: string;
  awarded_count: number;
}

export default function AdminPage() {
  const { profile, supabase, loading } = useAuth();
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [trophyLoading, setTrophyLoading] = useState(true);
  const [trophyOverview, setTrophyOverview] = useState<TrophyOverview[]>([]);
  const [totalAwardedTrophies, setTotalAwardedTrophies] = useState(0);

  useEffect(() => {
    const fetchAdminData = async () => {
      const [settingsRes, overviewRes, awardedRes] = await Promise.all([
        supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'registration_enabled')
          .single(),
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
        setRegistrationEnabled(settingsRes.data.value === 'true');
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
    }
    setToggling(false);
  };

  if (loading || settingsLoading || trophyLoading) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <Card>
          <h2 className="text-2xl font-bold">Ei käyttöoikeutta</h2>
          <p className="text-gray-500 mt-2">Tämä sivu on vain ylläpitäjille.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 mb-12 space-y-6">
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <Shield size={28} className="text-yellow-600" />
          <h1 className="text-3xl font-bold">Hallinta</h1>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-gray-600" />
            <div>
              <p className="font-medium">Rekisteröityminen</p>
              <p className="text-sm text-gray-500">
                {registrationEnabled
                  ? 'Uudet käyttäjät voivat rekisteröityä'
                  : 'Rekisteröityminen on suljettu'}
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
      </Card>

      <Card>
        <div className="flex items-center gap-3 mb-3">
          <Trophy size={24} className="text-yellow-600" />
          <h2 className="text-2xl font-bold">Kunniamerkit (Legacy baseline)</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Tunnistettu {trophyOverview.length} uniikkia kunniamerkkiä. Jaettuja merkkejä yhteensä {totalAwardedTrophies}.
        </p>

        <div className="space-y-2">
          {trophyOverview.slice(0, 20).map((trophy) => (
            <div key={trophy.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{trophy.name}</p>
                <p className="text-xs text-gray-500 truncate">{trophy.code}</p>
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
    </div>
  );
}
