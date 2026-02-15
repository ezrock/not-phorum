'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Calendar, Trophy, Shield, Link as LinkIcon, LogIn, Eye, BarChart3 } from 'lucide-react';
import { profileMedium } from '@/lib/cloudinary';

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string;
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

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, profile: myProfile, supabase } = useAuth();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [favouriteCategories, setFavouriteCategories] = useState<CategoryStat[]>([]);
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
        .select('id, username, display_name, avatar, profile_image_url, created_at, is_admin, signature, show_signature, link_url, link_description, login_count')
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
        for (const post of postData) {
          const topic = post.topic as any;
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

      setLoading(false);
    };

    fetchProfile();
  }, [supabase, userId]);

  const handleToggleAdmin = async () => {
    if (!profile) return;
    setTogglingAdmin(true);

    const newValue = !profile.is_admin;
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: newValue })
      .eq('id', profile.id);

    if (!error) {
      setProfile({ ...profile, is_admin: newValue });
      setAdminCount((prev) => prev + (newValue ? 1 : -1));
    }
    setTogglingAdmin(false);
  };

  const isCurrentUserAdmin = myProfile?.is_admin;
  const isLastAdmin = profile?.is_admin && adminCount <= 1;

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

      {/* Profile Header */}
      <Card className="mb-6">
        <div className="flex items-center gap-4">
          {profile.profile_image_url ? (
            <img src={profileMedium(profile.profile_image_url)} alt={profile.username} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <span className="text-7xl">{profile.avatar}</span>
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
              {profile.link_url && (
                <a
                  href={profile.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  <LinkIcon size={12} />
                  {profile.link_description || profile.link_url}
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
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <MessageSquare size={20} className="text-yellow-600" />
              <span className="text-3xl font-bold">{postCount}</span>
            </div>
            <p className="text-sm text-gray-500">Viestiä</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <MessageSquare size={20} className="text-yellow-600" />
              <span className="text-3xl font-bold">{topicCount}</span>
            </div>
            <p className="text-sm text-gray-500">Aloitettua aihetta</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <LogIn size={20} className="text-yellow-600" />
              <span className="text-3xl font-bold">{profile.login_count}</span>
            </div>
            <p className="text-sm text-gray-500">Kirjautumista</p>
          </div>
        </Card>
      </div>

      {/* Top Topics */}
      {(mostPopularTopic || mostActiveTopic) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {mostPopularTopic && (
            <Link href={`/forum/topic/${mostPopularTopic.id}`}>
              <Card className="hover:border-yellow-400 transition cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-gray-500">Suosituin aihe</span>
                </div>
                <p className="font-bold text-sm line-clamp-2">{mostPopularTopic.title}</p>
                <p className="text-xs text-gray-500 mt-1">{mostPopularTopic.views} katselua</p>
              </Card>
            </Link>
          )}
          {mostActiveTopic && (
            <Link href={`/forum/topic/${mostActiveTopic.id}`}>
              <Card className="hover:border-yellow-400 transition cursor-pointer h-full">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-gray-500">Aktiivisin aihe</span>
                </div>
                <p className="font-bold text-sm line-clamp-2">{mostActiveTopic.title}</p>
                <p className="text-xs text-gray-500 mt-1">{mostActiveTopic.reply_count} vastausta</p>
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Signature */}
      {profile.signature && profile.show_signature && (
        <Card className="mb-6">
          <p className="text-sm text-gray-600 italic whitespace-pre-wrap">{profile.signature}</p>
        </Card>
      )}

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
