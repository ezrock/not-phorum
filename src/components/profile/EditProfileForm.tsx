'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { CldUploadWidget } from 'next-cloudinary';
import { Save, Camera, X, Link as LinkIcon, User } from 'lucide-react';
import { profileThumb } from '@/lib/cloudinary';

interface CloudinaryUploadResult {
  info?: { secure_url?: string };
}

function extractSecureUrl(result: unknown): string | null {
  const typed = result as CloudinaryUploadResult;
  return typed?.info?.secure_url ?? null;
}

function isSafeHttpUrl(rawUrl: string): boolean {
  if (!rawUrl.trim()) return true;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function EditProfileForm() {
  const { currentUser, profile, supabase, refreshProfile } = useAuth();
  const typedProfile = profile as {
    username?: string;
    display_name?: string;
    profile_image_url?: string;
    signature?: string;
    show_signature?: boolean;
    link_url?: string;
    link_description?: string;
    is_admin?: boolean;
    realtime_updates_enabled?: boolean;
  } | null;

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [signature, setSignature] = useState('');
  const [showSignature, setShowSignature] = useState(true);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);

  const isAdmin = typedProfile?.is_admin === true;
  const usernameChanged = username.trim() !== (typedProfile?.username || '').trim();

  useEffect(() => {
    if (typedProfile) {
      setUsername(typedProfile.username || '');
      setDisplayName(typedProfile.display_name || '');
      setProfileImageUrl(typedProfile.profile_image_url || '');
      setSignature(typedProfile.signature || '');
      setShowSignature(typedProfile.show_signature ?? true);
      setLinkUrl(typedProfile.link_url || '');
      setLinkDescription(typedProfile.link_description || '');
    }
  }, [typedProfile]);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  const validateProfileForm = () => {
    setError('');
    setSuccess('');

    if (isAdmin && username.trim().length < 3) {
      setError('Käyttäjätunnuksen tulee olla vähintään 3 merkkiä');
      return false;
    }
    if (!isSafeHttpUrl(linkUrl)) {
      setError('Linkin pitää alkaa http:// tai https://');
      return false;
    }
    return true;
  };

  const saveProfile = async (allowUsernameChange: boolean) => {
    if (!currentUser) return;
    setSaving(true);

    try {
      const updates: {
        username?: string;
        display_name: string | null;
        profile_image_url: string | null;
        signature: string | null;
        show_signature: boolean;
        realtime_updates_enabled: boolean;
        link_url: string | null;
        link_description: string | null;
      } = {
        display_name: displayName.trim() || null,
        profile_image_url: profileImageUrl || null,
        signature: signature.trim() || null,
        show_signature: showSignature,
        realtime_updates_enabled: typedProfile?.realtime_updates_enabled ?? false,
        link_url: linkUrl.trim() || null,
        link_description: linkDescription.trim() || null,
      };

      if (allowUsernameChange && isAdmin) {
        updates.username = username.trim();
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      if (email !== currentUser.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }

      await refreshProfile();
      setSuccess('Profiili päivitetty!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Profiilin päivitys epäonnistui';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProfileForm()) return;

    if (isAdmin && usernameChanged) {
      setShowUsernameConfirm(true);
      return;
    }

    await saveProfile(false);
  };

  const handleConfirmUsernameChange = async () => {
    setShowUsernameConfirm(false);
    if (!validateProfileForm()) return;
    await saveProfile(true);
  };

  return (
    <>
      <Card className="mb-6">
        <h2 className="text-xl font-bold mb-4">Muokkaa profiilia</h2>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label htmlFor="username" className="flex items-center gap-2 text-sm font-medium mb-1">
              <span>Käyttäjätunnus</span>
              {isAdmin && (
                <span className="inline-flex items-center rounded bg-gray-200 text-gray-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Vain admin
                </span>
              )}
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              disabled={!isAdmin}
              className={!isAdmin ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}
            />
            <p className="text-xs text-gray-500 mt-1">
              {isAdmin
                ? 'Käyttäjätunnuksen muutos vaatii erillisen vahvistuksen.'
                : 'Käyttäjätunnusta voi muuttaa vain admin.'}
            </p>
          </div>

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium mb-1">
              Nimi
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
              placeholder="Valinnainen näyttönimi"
              maxLength={50}
            />
          </div>

          <div>
            <label htmlFor="signature" className="block text-sm font-medium mb-1">
              Allekirjoitus
            </label>
            <textarea
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg p-3 min-h-[80px] focus:border-yellow-400 focus:outline-none"
              placeholder="Näkyy viestien alla"
              maxLength={200}
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="showSignature"
                checked={showSignature}
                onChange={(e) => setShowSignature(e.target.checked)}
                className="w-4 h-4 accent-yellow-400"
              />
              <label htmlFor="showSignature" className="text-sm text-gray-600">
                Näytä allekirjoitus viesteissä
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Profiilikuva
            </label>
            <div className="flex items-center gap-4">
              {profileImageUrl ? (
                <div className="relative">
                  <img src={profileThumb(profileImageUrl)} alt="Profiilikuva" className="w-20 h-20 rounded-none object-cover" />
                  <button
                    type="button"
                    onClick={() => setProfileImageUrl('')}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span className="w-20 h-20 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
                  <User size={40} />
                </span>
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
                onSuccess={(result: unknown) => {
                  const secureUrl = extractSecureUrl(result);
                  if (secureUrl) setProfileImageUrl(secureUrl);
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
            {!profileImageUrl && <p className="text-xs text-gray-400 mt-1">Lisää profiilikuva näkyäksesi muille.</p>}
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
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <LinkIcon size={14} />
              Linkki
            </label>
            <div className="space-y-2">
              <Input
                id="linkUrl"
                type="url"
                value={linkUrl}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkUrl(e.target.value)}
                placeholder="https://..."
              />
              <Input
                id="linkDescription"
                value={linkDescription}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLinkDescription(e.target.value)}
                placeholder="Linkin kuvaus (esim. Oma blogi)"
                maxLength={50}
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Tallennetaan...' : 'Tallenna'}
          </Button>
        </form>
      </Card>

      {showUsernameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border-2 border-gray-800 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold mb-2">Vahvista käyttäjätunnuksen muutos</h3>
            <p className="text-sm text-gray-600 mb-4">
              Olet muuttamassa käyttäjätunnusta:
              <br />
              <span className="font-semibold text-gray-800">{typedProfile?.username}</span>
              {' -> '}
              <span className="font-semibold text-gray-800">{username.trim()}</span>
            </p>
            <p className="text-xs text-gray-500 mb-5">
              Tämä muutos näkyy kaikkialla foorumilla. Haluatko varmasti jatkaa?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUsernameConfirm(false)}
                disabled={saving}
              >
                Peruuta
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleConfirmUsernameChange}
                disabled={saving}
              >
                Vahvista muutos
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
