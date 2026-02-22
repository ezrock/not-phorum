'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { CldUploadWidget } from 'next-cloudinary';
import { Save, Camera, X, Link as LinkIcon, User, Lock, Pencil } from 'lucide-react';
import { extractSecureUrl, profileThumb } from '@/lib/cloudinary';
import { getCloudinaryUploadPresetOrThrow, getProfileUploadWidgetOptions } from '@/lib/cloudinaryWidget';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';
import { getFirstValidationError, rules, validate } from '@/lib/validation';

interface AdminTargetProfile {
  username?: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  signature?: string | null;
  show_signature?: boolean;
  link_url?: string | null;
  link_description?: string | null;
  hide_email?: boolean;
}

export function EditProfileForm({
  targetUserId,
  targetProfileData,
  onSave,
}: {
  targetUserId?: string;
  targetProfileData?: AdminTargetProfile;
  onSave?: () => void;
} = {}) {
  const { currentUser, profile, supabase, refreshProfile } = useAuth();
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;
  const uploadPreset = getCloudinaryUploadPresetOrThrow();
  const typedProfile = profile as {
    username?: string;
    display_name?: string;
    profile_image_url?: string;
    signature?: string;
    show_signature?: boolean;
    link_url?: string;
    link_description?: string;
    hide_email?: boolean;
    is_admin?: boolean;
    realtime_updates_enabled?: boolean;
  } | null;

  const isAdminEditMode = !!targetUserId;
  const formSource: AdminTargetProfile | typeof typedProfile = targetProfileData ?? typedProfile;

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [signature, setSignature] = useState('');
  const [showSignature, setShowSignature] = useState(true);
  const [hideEmail, setHideEmail] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const isAdmin = isAdminEditMode || typedProfile?.is_admin === true;
  const originalUsername = (formSource?.username || '');
  const usernameChanged = username.trim() !== originalUsername.trim();

  useEffect(() => {
    if (formSource) {
      setUsername(formSource.username || '');
      setDisplayName(formSource.display_name || '');
      setProfileImageUrl(formSource.profile_image_url || '');
      setSignature(formSource.signature || '');
      setShowSignature(formSource.show_signature ?? true);
      setHideEmail(formSource.hide_email ?? false);
      setLinkUrl(formSource.link_url || '');
      setLinkDescription(formSource.link_description || '');
    }
  }, [formSource]);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isAdminEditMode || !targetUserId) return;
    supabase
      .rpc('get_user_email', { target_user_id: targetUserId })
      .then(({ data }) => setTargetEmail(data || ''));
  }, [isAdminEditMode, targetUserId, supabase]);

  const validateProfileForm = () => {
    setError('');
    setSuccess('');

    const validation = validate(
      { username: username.trim(), linkUrl: linkUrl.trim() },
      {
        username: [
          rules.custom(
            (value: unknown) => {
              const v = typeof value === 'string' ? value : '';
              return !isAdmin || v.length >= 3;
            },
            'Käyttäjätunnuksen tulee olla vähintään 3 merkkiä'
          ),
        ],
        linkUrl: [
          rules.httpUrlOptional('Linkin pitää alkaa http:// tai https://'),
        ],
      }
    );
    const firstError = getFirstValidationError(validation);
    if (firstError) {
      setError(firstError);
      return false;
    }
    return true;
  };

  const saveProfile = async (allowUsernameChange: boolean) => {
    if (!currentUser) return;
    setSaving(true);

    try {
      if (isAdminEditMode && targetUserId) {
        const { error: rpcError } = await supabase.rpc('admin_update_profile', {
          target_user_id:      targetUserId,
          p_username:          allowUsernameChange ? username.trim() : originalUsername,
          p_display_name:      displayName.trim() || null,
          p_profile_image_url: profileImageUrl || null,
          p_signature:         signature.trim() || null,
          p_show_signature:    showSignature,
          p_link_url:          linkUrl.trim() || null,
          p_link_description:  linkDescription.trim() || null,
          p_email:             targetEmail.trim() || null,
          p_hide_email:        hideEmail,
        });
        if (rpcError) throw rpcError;
      } else {
        const updates: {
          username?: string;
          display_name: string | null;
          profile_image_url: string | null;
          signature: string | null;
          show_signature: boolean;
          hide_email: boolean;
          realtime_updates_enabled: boolean;
          link_url: string | null;
          link_description: string | null;
        } = {
          display_name: displayName.trim() || null,
          profile_image_url: profileImageUrl || null,
          signature: signature.trim() || null,
          show_signature: showSignature,
          hide_email: hideEmail,
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
      }

      onSave?.();
      setSuccess('Profiili päivitetty!');
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as { message: unknown }).message)
          : 'Profiilin päivitys epäonnistui';
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

    const validation = validate(
      { newPassword, confirmPassword },
      {
        newPassword: [
          rules.minLength(8, 'Salasanan tulee olla vähintään 8 merkkiä'),
          rules.passwordStrong('Salasanassa tulee olla isoja ja pieniä kirjaimia sekä numeroita'),
        ],
        confirmPassword: [
          rules.equalsField('newPassword', 'Salasanat eivät täsmää'),
        ],
      }
    );
    const firstError = getFirstValidationError(validation);
    if (firstError) {
      setPasswordError(firstError);
      return;
    }

    setSavingPassword(true);

    try {
      const { error: passwordUpdateError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordUpdateError) throw passwordUpdateError;

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
        <h2 className="card-title flex items-center gap-2">
          {showHeaderIcons && <Pencil size={20} className="text-yellow-600" />}
          Muokkaa profiilia
        </h2>

        {error && <Alert variant="error">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <form onSubmit={handleSaveProfile} className="mt-4">

          {/* ── Käyttäjätiedot ─────────────────────────────── */}
          <div>
            <h3 className="form-section-title">Käyttäjätiedot</h3>
            <div className="form-fields">
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
                <p className="text-muted-xs mt-1">
                  {isAdmin
                    ? 'Käyttäjätunnuksen muutos vaatii erillisen vahvistuksen.'
                    : 'Käyttäjätunnusta voi muuttaa vain admin.'}
                </p>
              </div>

              <div>
                <label htmlFor="displayName" className="form-label">Nimi</label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                  placeholder="Valinnainen näyttönimi"
                  maxLength={50}
                />
              </div>
            </div>
          </div>

          {/* ── Profiilikuva ───────────────────────────────── */}
          <div className="form-section">
            <h3 className="form-section-title">Profiilikuva</h3>
            <div className="flex items-center gap-4">
              {profileImageUrl ? (
                <div className="relative">
                  <img src={profileThumb(profileImageUrl)} alt="Profiilikuva" className="w-20 h-20 rounded-none object-cover" />
                  <button type="button" onClick={() => setProfileImageUrl('')} className="btn-image-remove">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <span className="w-20 h-20 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
                  <User size={40} />
                </span>
              )}
              <CldUploadWidget
                uploadPreset={uploadPreset}
                options={getProfileUploadWidgetOptions()}
                onSuccess={(result: unknown) => {
                  const secureUrl = extractSecureUrl(result);
                  if (secureUrl) setProfileImageUrl(secureUrl);
                }}
              >
                {({ open }) => (
                  <Button type="button" variant="outline" onClick={() => open()}>
                    <Camera size={16} />
                    {profileImageUrl ? 'Vaihda kuva' : 'Lataa kuva'}
                  </Button>
                )}
              </CldUploadWidget>
            </div>
            {!profileImageUrl && <p className="text-xs text-gray-400 mt-2">Lisää profiilikuva näkyäksesi muille.</p>}
          </div>

          {/* ── Esittely ───────────────────────────────────── */}
          <div className="form-section">
            <h3 className="form-section-title">Esittely</h3>
            <div className="form-fields">
              {/* Allekirjoitus + toggle – tightly grouped */}
              <div className="form-field-group">
                <div>
                  <label htmlFor="signature" className="form-label">Allekirjoitus</label>
                  <textarea
                    id="signature"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    className="field-textarea field-textarea--profile-signature"
                    placeholder="Näkyy viestien alla"
                    maxLength={200}
                  />
                </div>
                <div className="setting-toggle-row">
                  <div>
                    <p className="text-sm font-medium">Näytä allekirjoitus</p>
                    <p className="text-muted-sm">{showSignature ? 'Näkyy viestien alla' : 'Piilotettu viesteissä'}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showSignature}
                    aria-label="Näytä allekirjoitus"
                    onClick={() => setShowSignature(!showSignature)}
                    className={`toggle-btn ${showSignature ? 'toggle-btn--on' : 'toggle-btn--off'}`}
                  >
                    <span className={`toggle-indicator ${showSignature ? 'toggle-indicator--on' : 'toggle-indicator--off'}`} />
                  </button>
                </div>
              </div>

              {/* Linkki – more gap via form-fields, separate from signature group */}
              <div>
                <label className="form-label inline-flex items-center gap-1">
                  <LinkIcon size={14} />
                  Linkki
                </label>
                <div className="form-field-group mt-1">
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
            </div>
          </div>

          {/* ── Yhteystiedot ───────────────────────────────── */}
          <div className="form-section">
            <h3 className="form-section-title">Yhteystiedot</h3>
            <div className="form-field-group">
              <div>
                <label htmlFor="email" className="form-label">Sähköposti</label>
                {isAdminEditMode ? (
                  <Input
                    id="email"
                    type="email"
                    value={targetEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTargetEmail(e.target.value)}
                  />
                ) : (
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                )}
              </div>
              <div className="setting-toggle-row">
                <div>
                  <p className="text-sm font-medium">Piilota sähköpostiosoite</p>
                  <p className="text-muted-sm">{hideEmail ? 'Sähköposti piilotettu muilta' : 'Sähköposti näkyy profiilissa'}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideEmail}
                  aria-label="Piilota sähköpostiosoite"
                  onClick={() => setHideEmail(!hideEmail)}
                  className={`toggle-btn ${hideEmail ? 'toggle-btn--on' : 'toggle-btn--off'}`}
                >
                  <span className={`toggle-indicator ${hideEmail ? 'toggle-indicator--on' : 'toggle-indicator--off'}`} />
                </button>
              </div>
            </div>
          </div>

          <Button type="submit" variant="primary" disabled={saving} className="mt-6">
            <Save size={16} />
            {saving ? 'Tallennetaan...' : 'Tallenna'}
          </Button>
        </form>
      </Card>

      {!isAdminEditMode && <Card className="mt-6 mb-6">
        <h2 className="card-title flex items-center gap-2">
          {showHeaderIcons && <Lock size={20} className="text-yellow-600" />}
          Vaihda salasana
        </h2>

        {passwordError && <Alert variant="error">{passwordError}</Alert>}
        {passwordSuccess && <Alert variant="success">{passwordSuccess}</Alert>}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="form-label">
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
            <label htmlFor="confirmPassword" className="form-label">
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
          >
            <Lock size={16} />
            {savingPassword ? 'Vaihdetaan...' : 'Vaihda salasana'}
          </Button>
        </form>
      </Card>}

      {showUsernameConfirm && (
        <div className="modal-overlay">
          <div className="modal-panel modal-panel-md">
            <h3 className="text-lg font-bold mb-2">Vahvista käyttäjätunnuksen muutos</h3>
            <p className="text-sm text-gray-600 mb-4">
              Olet muuttamassa käyttäjätunnusta:
              <br />
              <span className="font-semibold text-gray-800">{originalUsername}</span>
              {' -> '}
              <span className="font-semibold text-gray-800">{username.trim()}</span>
            </p>
            <p className="text-muted-xs mb-5">
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
