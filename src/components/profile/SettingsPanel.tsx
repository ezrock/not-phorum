'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { Settings2, RefreshCw, Palette, Music2 } from 'lucide-react';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';

interface SettingsPanelProps {
  initialRealtimeEnabled: boolean;
  initialRetroEnabled: boolean;
  initialMidiEnabled: boolean;
}

export function SettingsPanel({ initialRealtimeEnabled, initialRetroEnabled, initialMidiEnabled }: SettingsPanelProps) {
  const { currentUser, supabase, refreshProfile } = useAuth();
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;

  const [realtimeUpdatesEnabled, setRealtimeUpdatesEnabled] = useState(initialRealtimeEnabled);
  const [retroEnabled, setRetroEnabled] = useState(initialRetroEnabled);
  const [midiEnabled, setMidiEnabled] = useState(initialMidiEnabled);
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

  const handleMidiToggle = async (nextValue: boolean) => {
    if (!currentUser) return;

    setSettingsError('');
    setSettingsSuccess('');
    setMidiEnabled(nextValue);
    setSavingSettings(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ midi_enabled: nextValue })
        .eq('id', currentUser.id);

      if (error) throw error;

      await refreshProfile();
      setSettingsSuccess('Asetukset tallennettu!');
    } catch (err: unknown) {
      setMidiEnabled((prev) => !prev);
      const message = err instanceof Error ? err.message : 'Asetusten tallennus epäonnistui';
      setSettingsError(message);
    } finally {
      setSavingSettings(false);
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
        <section className="subsection">
          <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <RefreshCw size={20} className="text-gray-600" />
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

        <section className="subsection">
          <h3 className="subsection-title">High definition graphics &amp; audio</h3>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Palette size={20} className="text-gray-600" />
              <div>
                <p className="font-medium">Retrolasit päähän</p>
                <p className="text-sm text-gray-500">
                  {retroEnabled ? 'CRT-suodatin käytössä' : 'Normaali näkymä käytössä'}
                </p>
              </div>
            </div>
            <button
              id="retroEnabled"
              type="button"
              role="switch"
              aria-checked={retroEnabled}
              aria-label="Retro"
              disabled={savingSettings}
              onClick={() => handleRetroToggle(!retroEnabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                retroEnabled ? 'bg-green-500' : 'bg-gray-300'
              } ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  retroEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Music2 size={20} className="text-gray-600" />
              <div>
                <p className="font-medium">.mid (On/Off)</p>
                <p className="text-sm text-gray-500">
                  {midiEnabled ? 'Styge soi' : 'You died'}
                </p>
              </div>
            </div>
            <button
              id="midiEnabled"
              type="button"
              role="switch"
              aria-checked={midiEnabled}
              aria-label=".mid"
              disabled={savingSettings}
              onClick={() => handleMidiToggle(!midiEnabled)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                midiEnabled ? 'bg-green-500' : 'bg-gray-300'
              } ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  midiEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </section>
      </div>
    </Card>
  );
}
