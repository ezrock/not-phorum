'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { Palette, Music2, Sparkles } from 'lucide-react';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';

interface HdSettingsPanelProps {
  initialRetroEnabled: boolean;
  initialMidiEnabled: boolean;
}

export function HdSettingsPanel({ initialRetroEnabled, initialMidiEnabled }: HdSettingsPanelProps) {
  const { currentUser, supabase, refreshProfile } = useAuth();
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;
  const showSettingActionIcons = UI_ICON_SETTINGS.showSettingActionIcons;

  const [retroEnabled, setRetroEnabled] = useState(initialRetroEnabled);
  const [midiEnabled, setMidiEnabled] = useState(initialMidiEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRetroToggle = async (nextValue: boolean) => {
    if (!currentUser) return;

    setError('');
    setSuccess('');
    setRetroEnabled(nextValue);
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ retro_enabled: nextValue })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess('Asetukset tallennettu!');
    } catch (err: unknown) {
      setRetroEnabled((prev) => !prev);
      const message = err instanceof Error ? err.message : 'Asetusten tallennus epäonnistui';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleMidiToggle = async (nextValue: boolean) => {
    if (!currentUser) return;

    setError('');
    setSuccess('');
    setMidiEnabled(nextValue);
    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ midi_enabled: nextValue })
        .eq('id', currentUser.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess('Asetukset tallennettu!');
    } catch (err: unknown) {
      setMidiEnabled((prev) => !prev);
      const message = err instanceof Error ? err.message : 'Asetusten tallennus epäonnistui';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-6">
      <h2 className="card-title flex items-center gap-2">
        {showHeaderIcons && <Sparkles size={20} className="text-yellow-600" />}
        High definition graphics &amp; audio
      </h2>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <section className="section-block">
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {showSettingActionIcons && <Palette size={20} className="text-gray-600" />}
            <div>
              <p className="font-medium">Retrolasit päähän</p>
              <p className="text-muted-sm">
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
            disabled={saving}
            onClick={() => handleRetroToggle(!retroEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              retroEnabled ? 'bg-green-500' : 'bg-gray-300'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            {showSettingActionIcons && <Music2 size={20} className="text-gray-600" />}
            <div>
              <p className="font-medium">.mid</p>
              <p className="text-muted-sm">
                {midiEnabled ? 'Styge soi... epävireisesti' : 'You died.'}
              </p>
            </div>
          </div>
          <button
            id="midiEnabled"
            type="button"
            role="switch"
            aria-checked={midiEnabled}
            aria-label=".mid"
            disabled={saving}
            onClick={() => handleMidiToggle(!midiEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
              midiEnabled ? 'bg-green-500' : 'bg-gray-300'
            } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                midiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>
    </Card>
  );
}
