'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { CldUploadWidget } from 'next-cloudinary';
import { Save, Camera, X, Lock, Link as LinkIcon, MessageSquare, LogIn, Eye, BarChart3, Trophy, User } from 'lucide-react';
import Link from 'next/link';
import { profileMedium, profileThumb } from '@/lib/cloudinary';
import { TopFiveCard } from '@/components/profile/TopFiveCard';
import { trophyLocalIconUrl } from '@/lib/trophies';

interface CloudinaryUploadResult {
  info?: {
    secure_url?: string;
  };
}

interface ProfileTrophy {
  id: number;
  code: string;
  name: string;
  points: number;
  icon_path: string | null;
}

interface ProfileTrophyRow {
  trophy: ProfileTrophy | ProfileTrophy[] | null;
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

export default function ProfilePage() {
  const { currentUser, profile, loading, supabase, refreshProfile } = useAuth();
  const typedProfile = profile as {
    username?: string;
    display_name?: string;
    profile_image_url?: string;
    signature?: string;
    show_signature?: boolean;
    link_url?: string;
    link_description?: string;
    is_admin?: boolean;
    created_at?: string;
    login_count?: number;
    realtime_updates_enabled?: boolean;
  } | null;

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [signature, setSignature] = useState('');
  const [showSignature, setShowSignature] = useState(true);
  const [realtimeUpdatesEnabled, setRealtimeUpdatesEnabled] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [postCount, setPostCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [trophies, setTrophies] = useState<ProfileTrophy[]>([]);
  const [mostPopularTopic, setMostPopularTopic] = useState<{ id: number; title: string; views: number } | null>(null);
  const [mostActiveTopic, setMostActiveTopic] = useState<{ id: number; title: string; reply_count: number } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);

  // Sync form state when profile loads
  useEffect(() => {
    if (typedProfile) {
      setUsername(typedProfile.username || '');
      setDisplayName(typedProfile.display_name || '');
      setProfileImageUrl(typedProfile.profile_image_url || '');
      setSignature(typedProfile.signature || '');
      setShowSignature(typedProfile.show_signature ?? true);
      setRealtimeUpdatesEnabled(typedProfile.realtime_updates_enabled ?? false);
      setLinkUrl(typedProfile.link_url || '');
      setLinkDescription(typedProfile.link_description || '');
    }
  }, [typedProfile]);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // Fetch stats
  useEffect(() => {
    if (!currentUser) return;
    const userId = currentUser.id;

    const fetchStats = async () => {
      const [postsRes, topicsRes, popularRes, activeRes, trophiesRes] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('topics').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('topics').select('id, title, views').eq('author_id', userId).order('views', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('topics').select('id, title, reply_count').eq('author_id', userId).order('reply_count', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('profile_trophies').select('trophy:trophies(id, code, name, points, icon_path)').eq('profile_id', userId),
      ]);

      setPostCount(postsRes.count || 0);
      setTopicCount(topicsRes.count || 0);
      if (popularRes.data) setMostPopularTopic(popularRes.data);
      if (activeRes.data) setMostActiveTopic(activeRes.data);

      if (trophiesRes.data) {
        const parsed = (trophiesRes.data as ProfileTrophyRow[])
          .map((row) => (Array.isArray(row.trophy) ? row.trophy[0] : row.trophy))
          .filter((trophy): trophy is ProfileTrophy => Boolean(trophy))
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        setTrophies(parsed);
      }
    };

    fetchStats();
  }, [currentUser, supabase]);

  const isAdmin = typedProfile?.is_admin === true;
  const usernameChanged = username.trim() !== (typedProfile?.username || '').trim();

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
        realtime_updates_enabled: realtimeUpdatesEnabled,
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
        const { error: emailError } = await supabase.auth.updateUser({
          email,
        });
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Salasanan vaihto epäonnistui';
      setPasswordError(message);
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

  if (loading || !typedProfile) {
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
        <div className="flex items-center gap-4 mb-4">
          {profileImageUrl ? (
            <img src={profileMedium(profileImageUrl)} alt={typedProfile.username || 'Profiili'} className="w-16 h-16 rounded-none object-cover" />
          ) : (
            <span className="w-16 h-16 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
              <User size={34} />
            </span>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'monospace' }}>{typedProfile.username}</h1>
            <p className="text-sm text-gray-500">
             Liittymispäivä {typedProfile.created_at ? formatDate(typedProfile.created_at) : ''}
            </p>
          </div>
        </div>

        <hr className="border-gray-200 mb-4" />

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <MessageSquare size={18} className="text-yellow-600" />
            <span className="text-sm text-gray-500 flex-1">Viestiä</span>
            <span className="font-bold">{postCount}</span>
          </div>
          <div className="flex items-center gap-3">
            <MessageSquare size={18} className="text-yellow-600" />
            <span className="text-sm text-gray-500 flex-1">Aloitettua aihetta</span>
            <span className="font-bold">{topicCount}</span>
          </div>
          <div className="flex items-center gap-3">
            <LogIn size={18} className="text-yellow-600" />
            <span className="text-sm text-gray-500 flex-1">Kirjautumista</span>
            <span className="font-bold">{typedProfile.login_count || 0}</span>
          </div>
          {mostPopularTopic && (
            <Link href={`/forum/topic/${mostPopularTopic.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition">
              <Eye size={18} className="text-yellow-600" />
              <span className="text-sm text-gray-500 flex-shrink-0">Suosituin aihe</span>
              <span className="font-bold text-sm text-right flex-1 truncate">{mostPopularTopic.title}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{mostPopularTopic.views} katselua</span>
            </Link>
          )}
          {mostActiveTopic && (
            <Link href={`/forum/topic/${mostActiveTopic.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition">
              <BarChart3 size={18} className="text-yellow-600" />
              <span className="text-sm text-gray-500 flex-shrink-0">Aktiivisin aihe</span>
              <span className="font-bold text-sm text-right flex-1 truncate">{mostActiveTopic.title}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{mostActiveTopic.reply_count} vastausta</span>
            </Link>
          )}
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy size={20} className="text-yellow-600" />
          Kunniamerkit
        </h2>

        {trophies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {trophies.map((trophy) => (
              <span
                key={trophy.id}
                className="inline-flex items-center rounded bg-yellow-100 text-yellow-800 px-2 py-1 text-xs font-medium"
                title={`${trophy.name} (${trophy.points} p)`}
              >
                {trophyLocalIconUrl(trophy.icon_path) && (
                  <img
                    src={trophyLocalIconUrl(trophy.icon_path) as string}
                    alt={trophy.name}
                    className="w-4 h-5 object-contain mr-1"
                  />
                )}
                {trophy.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ei kunniamerkkejä vielä.</p>
        )}
      </Card>

      {currentUser && <TopFiveCard profileId={currentUser.id} className="mb-6" />}

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
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="realtimeUpdatesEnabled"
                checked={realtimeUpdatesEnabled}
                onChange={(e) => setRealtimeUpdatesEnabled(e.target.checked)}
                className="w-4 h-4 accent-yellow-400"
              />
              <label htmlFor="realtimeUpdatesEnabled" className="text-sm text-gray-600">
                Reaaliaikaiset päivitykset ketjuille ja viesteille
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
                  if (secureUrl) {
                    setProfileImageUrl(secureUrl);
                  }
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
            variant="primary"
            disabled={savingPassword}
            className="flex items-center gap-2"
          >
            <Lock size={16} />
            {savingPassword ? 'Vaihdetaan...' : 'Vaihda salasana'}
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
              <span className="font-semibold text-gray-800">{typedProfile.username}</span>
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
    </div>
  );
}
