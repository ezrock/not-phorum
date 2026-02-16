'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Calendar, Trophy, Shield, Link as LinkIcon, LogIn, Eye, BarChart3, User } from 'lucide-react';
import { profileMedium } from '@/lib/cloudinary';

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
  login_count: number;
}

interface TopicStat {
  id: number;
  title: string;
  views: number;
  reply_count: number;
}

interface CategoryStat {
  name: string;
  icon: string;
  count: number;
}

interface PostCategoryRow {
  topic: {
    category: {
      name: string;
      icon: string;
    } | null;
  } | null;
}

interface ProfileTrophy {
  id: number;
  code: string;
  name: string;
  points: number;
}

interface ProfileTrophyRow {
  trophy: ProfileTrophy | ProfileTrophy[] | null;
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
  const [postCount, setPostCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [favouriteCategories, setFavouriteCategories] = useState<CategoryStat[]>([]);
  const [trophies, setTrophies] = useState<ProfileTrophy[]>([]);
  const [mostPopularTopic, setMostPopularTopic] = useState<TopicStat | null>(null);
  const [mostActiveTopic, setMostActiveTopic] = useState<TopicStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminCount, setAdminCount] = useState(0);
  const [togglingAdmin, setTogglingAdmin] = useState(false);

  // Redirect to own profile page if viewing self
  useEffect(() => {
    if (currentUser && userId === currentUser.id) {
      router.replace('/profile');
    }
  }, [currentUser, userId, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, display_name, profile_image_url, created_at, is_admin, signature, show_signature, link_url, link_description, login_count')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData as UserProfile);
      }

      // Count admins (for last-admin protection)
      const { count: admins } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', true);

      setAdminCount(admins || 0);

      // Count posts
      const { count: posts } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId);

      setPostCount(posts || 0);

      // Count topics
      const { count: topics } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId);

      setTopicCount(topics || 0);

      // Get favourite categories (from posts → topics → categories)
      const { data: postData } = await supabase
        .from('posts')
        .select('topic:topics(category:categories(name, icon))')
        .eq('author_id', userId);

      if (postData) {
        const catCounts: Record<string, CategoryStat> = {};
        for (const post of postData as PostCategoryRow[]) {
          const topic = post.topic;
          const cat = topic?.category;
          if (cat?.name) {
            if (!catCounts[cat.name]) {
              catCounts[cat.name] = { name: cat.name, icon: cat.icon, count: 0 };
            }
            catCounts[cat.name].count++;
          }
        }
        const sorted = Object.values(catCounts).sort((a, b) => b.count - a.count);
        setFavouriteCategories(sorted.slice(0, 5));
      }

      // Most popular topic (by views)
      const { data: popularTopic } = await supabase
        .from('topics')
        .select('id, title, views, reply_count')
        .eq('author_id', userId)
        .order('views', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (popularTopic) setMostPopularTopic(popularTopic as TopicStat);

      // Most active topic (by replies)
      const { data: activeTopic } = await supabase
        .from('topics')
        .select('id, title, views, reply_count')
        .eq('author_id', userId)
        .order('reply_count', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeTopic) setMostActiveTopic(activeTopic as TopicStat);

      const { data: trophyData } = await supabase
        .from('profile_trophies')
        .select('trophy:trophies(id, code, name, points)')
        .eq('profile_id', userId);

      if (trophyData) {
        const parsed = (trophyData as ProfileTrophyRow[])
          .map((row) => (Array.isArray(row.trophy) ? row.trophy[0] : row.trophy))
          .filter((trophy): trophy is ProfileTrophy => Boolean(trophy))
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        setTrophies(parsed);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [supabase, userId]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fi-FI', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto mt-8 px-4">
        <Card>
          <h2 className="text-2xl font-bold">Käyttäjää ei löytynyt</h2>
          <Link href="/forum">
            <Button className="mt-4" onClick={() => {}}>Takaisin foorumille</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 px-4 mb-12">
      <div className="mb-6">
        <Link href="/forum" className="flex items-center gap-2 text-yellow-600 hover:underline text-sm">
          <ArrowLeft size={16} />
          Takaisin foorumille
        </Link>
      </div>

      {/* Profile Header + Stats */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          {profile.profile_image_url ? (
            <img src={profileMedium(profile.profile_image_url)} alt={profile.username} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <span className="w-20 h-20 rounded-full bg-gray-200 text-gray-500 inline-flex items-center justify-center">
              <User size={42} />
            </span>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            {profile.display_name && (
              <p className="text-sm text-gray-600">{profile.display_name}</p>
            )}
            <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Calendar size={14} />
              Jäsen {formatDate(profile.created_at)} alkaen
            </p>
            <div className="flex items-center gap-2 mt-2">
              {isCurrentUserAdmin && profile.is_admin && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded">
                  <Shield size={12} />
                  Admin
                </span>
              )}
              {profileLink && (
                <a
                  href={profileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <LinkIcon size={12} />
                  {profile.link_description || profileLink}
                </a>
              )}
            </div>
          </div>
          {isCurrentUserAdmin && (
            <div className="flex-shrink-0">
              <button
                onClick={handleToggleAdmin}
                disabled={togglingAdmin || (isLastAdmin ?? false)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition ${
                  profile.is_admin
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                } ${(togglingAdmin || isLastAdmin) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isLastAdmin ? 'Vähintään yksi admin tarvitaan' : ''}
              >
                <Shield size={16} />
                {profile.is_admin ? 'Poista admin' : 'Tee admin'}
              </button>
            </div>
          )}
        </div>

        <hr className="border-gray-200 my-4" />

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
            <span className="font-bold">{profile.login_count}</span>
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

      {/* Signature */}
      {profile.signature && profile.show_signature && (
        <Card className="mb-6">
          <p className="text-sm text-gray-600 italic whitespace-pre-wrap">{profile.signature}</p>
        </Card>
      )}

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
                {trophy.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Ei kunniamerkkejä vielä.</p>
        )}
      </Card>

      {/* Favourite Categories */}
      {favouriteCategories.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-yellow-600" />
            Suosikkikategoriat
          </h2>
          <div className="space-y-3">
            {favouriteCategories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <span className="font-medium flex-1">{cat.name}</span>
                <span className="text-sm text-gray-500">{cat.count} viestiä</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
