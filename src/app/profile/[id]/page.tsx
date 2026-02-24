'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, Link as LinkIcon, User } from 'lucide-react';
import { profileMedium } from '@/lib/cloudinary';
import { TopFiveCard } from '@/components/profile/TopFiveCard';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { TrophiesCard } from '@/components/profile/TrophiesCard';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { useProfileStats } from '@/hooks/useProfileStats';
import { formatJoinedDate, formatFinnishRelative } from '@/lib/formatDate';

type PublicProfileTab = 'profile' | 'edit';

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  created_at: string;
  is_admin: boolean;
  signature: string | null;
  show_signature: boolean;
  link_url: string | null;
  link_description: string | null;
  hide_email: boolean;
  login_count: number;
  login_network_count: number;
  legacy_forum_user_id: number | null;
  last_activity_at: string | null;
}

function safeHttpUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, profile: myProfile, supabase } = useAuth();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminCount, setAdminCount] = useState(0);
  const [togglingAdmin, setTogglingAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<PublicProfileTab>('profile');

  const { postCount, topicCount, trophies, mostPopularTopic, mostActiveTopic } = useProfileStats(userId);

  // Redirect to own profile page if viewing self
  useEffect(() => {
    if (currentUser && userId === currentUser.id) {
      router.replace('/profile');
    }
  }, [currentUser, userId, router]);

  const fetchProfile = useCallback(async () => {
    const [profileRes, adminRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, profile_image_url, created_at, is_admin, signature, show_signature, link_url, link_description, hide_email, login_count, login_network_count, legacy_forum_user_id, last_activity_at')
        .eq('id', userId)
        .single(),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', true),
    ]);

    if (profileRes.data) setProfile(profileRes.data as UserProfile);
    setAdminCount(adminRes.count || 0);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleToggleAdmin = async () => {
    if (!profile) return;
    setTogglingAdmin(true);

    const newValue = !profile.is_admin;
    const { error } = await supabase.rpc('set_user_admin', {
      target_user_id: profile.id,
      make_admin: newValue,
    });

    if (!error) {
      setProfile({ ...profile, is_admin: newValue });
      setAdminCount((prev) => prev + (newValue ? 1 : -1));
    }
    setTogglingAdmin(false);
  };

  const isCurrentUserAdmin = myProfile?.is_admin;
  const isLastAdmin = profile?.is_admin && adminCount <= 1;
  const profileLink = safeHttpUrl(profile?.link_url ?? null);

  if (loading) {
    return (
      <div className="page-container">
        <Card>
          <p className="state-empty-text">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-container">
        <Card>
          <h2 className="text-2xl font-bold">Käyttäjää ei löytynyt</h2>
          <Link href="/" className="app-back-link mt-4">
            <ArrowLeft size={16} />
            Takaisin foorumille
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-6">
        <Link href="/" className="app-back-link">
          <ArrowLeft size={16} />
          Takaisin foorumille
        </Link>
      </div>

      {isCurrentUserAdmin && (
        <div className="page-tabs mb-6">
          <button
            type="button"
            className={`page-tab-button ${activeTab === 'profile' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profiili
          </button>
          <button
            type="button"
            className={`page-tab-button ${activeTab === 'edit' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Muokkaa
          </button>
        </div>
      )}

      {(!isCurrentUserAdmin || activeTab === 'profile') && <>
      {/* Profile Header + Stats */}
      <Card className="mb-6">
        <div className="flex items-start gap-4">
          {profile.profile_image_url ? (
            <img src={profileMedium(profile.profile_image_url)} alt={profile.username} className="avatar-large" />
          ) : (
            <span className="avatar-large-fallback">
              <User size={30} />
            </span>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {profile.username}
              {isCurrentUserAdmin && profile.is_admin && (
                <span className="admin-badge">
                  <Shield size={12} />
                  Admin
                </span>
              )}
            </h1>
            {profile.display_name && (
              <p className="text-sm text-gray-600">{profile.display_name}</p>
            )}
            <p className="text-muted-sm mt-1">
              Jäsen vuodesta {formatJoinedDate(profile.created_at, profile.legacy_forum_user_id)}
            </p>
            {profile.last_activity_at && (
              <p className="text-muted-sm mt-0.5">
                Viimeksi aktiivinen {formatFinnishRelative(profile.last_activity_at)}
              </p>
            )}
            {profileLink && (
              <a
                href={profileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 mt-1"
              >
                <LinkIcon size={12} />
                {profile.link_description || profileLink}
              </a>
            )}
          </div>
          {isCurrentUserAdmin && (
            <button
              onClick={handleToggleAdmin}
              disabled={togglingAdmin || (isLastAdmin ?? false)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition ${
                profile.is_admin
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              } ${(togglingAdmin || isLastAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isLastAdmin ? 'Vähintään yksi admin tarvitaan' : ''}
            >
              <Shield size={16} />
              {profile.is_admin ? 'Poista admin' : 'Tee admin'}
            </button>
          )}
        </div>

        <hr className="border-gray-200 my-4" />

        <ProfileStats
          postCount={postCount}
          topicCount={topicCount}
          loginCount={profile.login_count}
          loginNetworkCount={profile.login_network_count || 0}
          mostPopularTopic={mostPopularTopic}
          mostActiveTopic={mostActiveTopic}
        />
      </Card>

      {/* Signature */}
      {profile.signature && profile.show_signature && (
        <Card className="mb-6">
          <p className="text-sm text-gray-600 italic whitespace-pre-wrap">{profile.signature}</p>
        </Card>
      )}

      <TrophiesCard trophies={trophies} />

      <TopFiveCard profileId={userId} />
      </>}

      {isCurrentUserAdmin && activeTab === 'edit' && (
        <EditProfileForm
          targetUserId={userId}
          targetProfileData={profile ?? undefined}
          onSave={fetchProfile}
        />
      )}
    </div>
  );
}
