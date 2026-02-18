'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { Settings2 } from 'lucide-react';

interface SettingsPanelProps {
  initialRealtimeEnabled: boolean;
  initialRetroEnabled: boolean;
}

export function SettingsPanel({ initialRealtimeEnabled, initialRetroEnabled }: SettingsPanelProps) {
  const { currentUser, supabase, refreshProfile } = useAuth();

  const [realtimeUpdatesEnabled, setRealtimeUpdatesEnabled] = useState(initialRealtimeEnabled);
  const [retroEnabled, setRetroEnabled] = useState(initialRetroEnabled);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

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
      const message = err instanceof Error ? err.message : 'Asetusten tallennus epäonnistui';
      setSettingsError(message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRetroToggle = async (nextValue: boolean) => {
    if (!currentUser) return;

    setSettingsError('');
    setSettingsSuccess('');
    setRetroEnabled(nextValue);
    setSavingSettings(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ retro_enabled: nextValue })
        .eq('id', currentUser.id);

      if (error) throw error;

      await refreshProfile();
      setSettingsSuccess('Asetukset tallennettu!');
    } catch (err: unknown) {
      setRetroEnabled((prev) => !prev);
      const message = err instanceof Error ? err.message : 'Asetusten tallennus epäonnistui';
      setSettingsError(message);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Card className="mb-6">
      <h2 className="card-title flex items-center gap-2">
        <Settings2 size={20} className="text-yellow-600" />
        Asetukset
      </h2>

      {settingsError && <Alert variant="error">{settingsError}</Alert>}
      {settingsSuccess && <Alert variant="success">{settingsSuccess}</Alert>}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 px-1 py-1">
          <label htmlFor="realtimeUpdatesEnabled" className="text-sm text-gray-700">
            Reaaliaikaiset päivitykset ketjuille ja viesteille
          </label>

          <button
            id="realtimeUpdatesEnabled"
            type="button"
            role="switch"
            aria-checked={realtimeUpdatesEnabled}
            aria-label="Reaaliaikaiset päivitykset ketjuille ja viesteille"
            disabled={savingSettings}
            onClick={() => handleRealtimeToggle(!realtimeUpdatesEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              realtimeUpdatesEnabled ? 'bg-yellow-500' : 'bg-gray-300'
            } ${savingSettings ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                realtimeUpdatesEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 px-1 py-1">
          <label htmlFor="retroEnabled" className="text-sm text-gray-700">
            Retro
          </label>

          <button
            id="retroEnabled"
            type="button"
            role="switch"
            aria-checked={retroEnabled}
            aria-label="Retro"
            disabled={savingSettings}
            onClick={() => handleRetroToggle(!retroEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              retroEnabled ? 'bg-yellow-500' : 'bg-gray-300'
            } ${savingSettings ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                retroEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}
