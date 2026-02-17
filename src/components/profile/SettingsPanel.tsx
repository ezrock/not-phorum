'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Settings2 } from 'lucide-react';

interface SettingsPanelProps {
  initialRealtimeEnabled: boolean;
}

export function SettingsPanel({ initialRealtimeEnabled }: SettingsPanelProps) {
  const { currentUser, supabase, refreshProfile } = useAuth();

  const [realtimeUpdatesEnabled, setRealtimeUpdatesEnabled] = useState(initialRealtimeEnabled);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('Salasanan tulee olla vähintään 8 merkkiä');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('Salasanassa tulee olla isoja ja pieniä kirjaimia sekä numeroita');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Salasanat eivät täsmää');
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordSuccess('Salasana vaihdettu!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Salasanan vaihto epäonnistui';
      setPasswordError(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Card className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings2 size={20} className="text-yellow-600" />
          Asetukset
        </h2>

        {settingsError && <Alert variant="error">{settingsError}</Alert>}
        {settingsSuccess && <Alert variant="success">{settingsSuccess}</Alert>}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
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
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Lock size={20} />
          Vaihda salasana
        </h2>

        {passwordError && <Alert variant="error">{passwordError}</Alert>}
        {passwordSuccess && <Alert variant="success">{passwordSuccess}</Alert>}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
              Uusi salasana
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Vähintään 8 merkkiä, isoja/pieniä kirjaimia ja numeroita"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Vahvista salasana
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Kirjoita salasana uudelleen"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={savingPassword}
            className="flex items-center gap-2"
          >
            <Lock size={16} />
            {savingPassword ? 'Vaihdetaan...' : 'Vaihda salasana'}
          </Button>
        </form>
      </Card>
    </>
  );
}
