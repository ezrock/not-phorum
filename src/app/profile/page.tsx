'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { CldUploadWidget } from 'next-cloudinary';
import { Save, Camera, X, Lock } from 'lucide-react';
import { profileMedium, profileThumb } from '@/lib/cloudinary';

const AVATAR_OPTIONS = ['🍄', '🎮', '🐱', '🦊', '🐼', '🦁', '🐯', '🐸', '🦄', '🐉'];

export default function ProfilePage() {
  const { currentUser, profile, loading, supabase, refreshProfile } = useAuth();

  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('🎮');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Sync form state when profile loads
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setAvatar(profile.avatar || '🎮');
      setProfileImageUrl(profile.profile_image_url || '');
    }
  }, [profile]);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

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
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          avatar,
          profile_image_url: profileImageUrl || null,
        })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Salasanan tulee olla vähintään 6 merkkiä');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Salasanat eivät täsmää');
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setPasswordSuccess('Salasana vaihdettu!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Salasanan vaihto epäonnistui');
    } finally {
      setSavingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  };

  if (loading || !profile) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4 mb-12">
      <Card className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          {profileImageUrl ? (
            <img src={profileMedium(profileImageUrl)} alt={profile?.username} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <span className="text-6xl">{profile?.avatar}</span>
          )}
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
            <label className="block text-sm font-medium mb-2">
              Profiilikuva
            </label>
            <div className="flex items-center gap-4">
              {profileImageUrl ? (
                <div className="relative">
                  <img src={profileThumb(profileImageUrl)} alt="Profiilikuva" className="w-20 h-20 rounded-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setProfileImageUrl('')}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span className="text-5xl">{avatar}</span>
              )}
              <CldUploadWidget
                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                options={{
                  maxFiles: 1,
                  resourceType: 'image',
                  folder: 'freakon/profiles',
                  cropping: true,
                  croppingAspectRatio: 1,
                }}
                onSuccess={(result: any) => {
                  setProfileImageUrl(result.info.secure_url);
                }}
              >
                {({ open }) => (
                  <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
                    <Camera size={16} />
                    {profileImageUrl ? 'Vaihda kuva' : 'Lataa kuva'}
                  </Button>
                )}
              </CldUploadWidget>
            </div>
            {!profileImageUrl && (
              <p className="text-xs text-gray-400 mt-1">Profiilikuva korvaa emoji-avatarin</p>
            )}
          </div>

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
              Emoji-avatar
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
            {profileImageUrl && (
              <p className="text-xs text-gray-400 mt-1">Emoji-avatar näkyy varana jos profiilikuva poistetaan</p>
            )}
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
              minLength={6}
              placeholder="Vähintään 6 merkkiä"
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
              minLength={6}
              placeholder="Kirjoita salasana uudelleen"
            />
          </div>

          <Button
            type="submit"
            variant="success"
            disabled={savingPassword}
            className="flex items-center gap-2"
          >
            <Lock size={16} />
            {savingPassword ? 'Vaihdetaan...' : 'Vaihda salasana'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
