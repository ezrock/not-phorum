'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { profileMedium } from '@/lib/cloudinary';
import { User, BarChart3 } from 'lucide-react';
import { formatFinnishDate } from '@/lib/formatDate';
import { TopFiveCard } from '@/components/profile/TopFiveCard';
import { ProfileStats } from '@/components/profile/ProfileStats';
import { TrophiesCard } from '@/components/profile/TrophiesCard';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { SettingsPanel } from '@/components/profile/SettingsPanel';
import { useProfileStats } from '@/hooks/useProfileStats';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';

type ProfileTab = 'profile' | 'edit' | 'settings';

export default function ProfilePage() {
  const { currentUser, profile, loading } = useAuth();
  const typedProfile = profile as {
    username?: string;
    profile_image_url?: string;
    created_at?: string;
    login_count?: number;
    realtime_updates_enabled?: boolean;
    retro_enabled?: boolean;
  } | null;

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const { postCount, topicCount, trophies, mostPopularTopic, mostActiveTopic } = useProfileStats(currentUser?.id ?? null);
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;

  if (loading || !typedProfile) {
    return (
      <div className="page-container">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-6 flex items-center gap-4">
        {typedProfile.profile_image_url ? (
          <img
            src={profileMedium(typedProfile.profile_image_url)}
            alt={typedProfile.username || 'Profiili'}
            className="w-16 h-16 rounded-none object-cover"
          />
        ) : (
          <span className="w-16 h-16 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
            <User size={34} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold truncate" style={{ fontFamily: 'monospace' }}>{typedProfile.username}</h1>
          <p className="text-sm text-gray-500">
            Liittymispäivä {typedProfile.created_at ? formatFinnishDate(typedProfile.created_at) : ''}
          </p>
        </div>
      </div>

      <div className="page-tabs mb-6">
        {(['profile', 'edit', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`page-tab-button ${activeTab === tab ? 'is-active' : ''}`}
          >
            {tab === 'profile' ? 'Profiili' : tab === 'edit' ? 'Muokkaa' : 'Asetukset'}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <>
          <Card className="mb-6">
            <h2 className="card-title flex items-center gap-2">
              {showHeaderIcons && <BarChart3 size={20} className="text-yellow-600" />}
              Tilastot
            </h2>

            <ProfileStats
              postCount={postCount}
              topicCount={topicCount}
              loginCount={typedProfile.login_count || 0}
              mostPopularTopic={mostPopularTopic}
              mostActiveTopic={mostActiveTopic}
            />
          </Card>

          <TrophiesCard trophies={trophies} />

          {currentUser && <TopFiveCard profileId={currentUser.id} className="mb-6" />}
        </>
      )}

      {activeTab === 'edit' && <EditProfileForm />}

      {activeTab === 'settings' && (
        <SettingsPanel
          initialRealtimeEnabled={typedProfile.realtime_updates_enabled ?? false}
          initialRetroEnabled={typedProfile.retro_enabled ?? false}
        />
      )}
    </div>
  );
}
