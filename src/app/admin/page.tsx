'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, UserPlus } from 'lucide-react';

export default function AdminPage() {
  const { profile, supabase, loading } = useAuth();
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'registration_enabled')
        .single();

      if (data) {
        setRegistrationEnabled(data.value === 'true');
      }
      setSettingsLoading(false);
    };

    fetchSettings();
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

  if (loading || settingsLoading) {
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
    <div className="max-w-2xl mx-auto mt-8 px-4 mb-12">
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <Shield size={28} className="text-yellow-600" />
          <h1 className="text-3xl font-bold">Hallinta</h1>
        </div>
      </Card>

      <Card>
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
    </div>
  );
}
