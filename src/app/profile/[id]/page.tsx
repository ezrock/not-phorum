'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Calendar, Trophy } from 'lucide-react';
import { profileMedium } from '@/lib/cloudinary';

interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  profile_image_url: string | null;
  created_at: string;
}

interface CategoryStat {
  name: string;
  icon: string;
  count: number;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, supabase } = useAuth();
  const userId = params.id as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [favouriteCategories, setFavouriteCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select('id, username, avatar, profile_image_url, created_at')
        .eq('id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

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

      setLoading(false);
    };

    fetchProfile();
  }, [supabase, userId]);

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
          <div>
            <h1 className="text-3xl font-bold">{profile.username}</h1>
            <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Calendar size={14} />
              Jäsen {formatDate(profile.created_at)} alkaen
            </p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
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
      </div>

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
