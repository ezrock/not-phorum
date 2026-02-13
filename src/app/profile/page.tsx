'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { Save } from 'lucide-react';

const AVATAR_OPTIONS = ['🍄', '🎮', '🐱', '🦊', '🐼', '🦁', '🐯', '🐸', '🦄', '🐉'];

export default function ProfilePage() {
  const { currentUser, profile, supabase, refreshProfile } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '🎮');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (username.trim().length < 3) {
      setError('Käyttäjätunnuksen tulee olla vähintään 3 merkkiä');
      return;
    }

    setSaving(true);

    try {
      // Update profile table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: username.trim(), avatar })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (email !== currentUser.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email,
        });
        if (emailError) throw emailError;
      }

      await refreshProfile();
      setSuccess('Profiili päivitetty!');
    } catch (err: any) {
      setError(err.message || 'Profiilin päivitys epäonnistui');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4 mb-12">
      <Card className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-6xl">{profile?.avatar}</span>
          <div>
            <h1 className="text-3xl font-bold">{profile?.username}</h1>
            <p className="text-sm text-gray-500">
              Jäsen {profile?.created_at ? formatDate(profile.created_at) : ''} alkaen
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-4">Muokkaa profiilia</h2>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Käyttäjätunnus
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Sähköposti
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Avatar
            </label>
            <div className="grid grid-cols-5 gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(emoji)}
                  className={`text-4xl p-2 rounded hover:bg-yellow-100 transition ${
                    avatar === emoji ? 'bg-yellow-200 ring-2 ring-yellow-400' : 'bg-gray-100'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            variant="success"
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Tallennetaan...' : 'Tallenna'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
