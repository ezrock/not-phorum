'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { BarChart3, Heart, Star, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profileThumb } from '@/lib/cloudinary';
import { UI_ICON_SETTINGS } from '@/lib/uiSettings';

interface TopFiveCardProps {
  profileId: string;
  className?: string;
}

interface TopTagStat {
  tag_id: number;
  tag_name: string;
  tag_slug: string;
  usage_count: number;
}

interface ViewedTopicStat {
  id: number;
  title: string;
  views: number;
}

interface TopLikedPost {
  post_id: number;
  topic_id: number;
  topic_title: string;
  content_preview: string;
  likes_count: number;
}

interface TopLikedAuthor {
  author_id: string;
  username: string;
  profile_image_url: string | null;
  likes_given: number;
}

export function TopFiveCard({ profileId, className = '' }: TopFiveCardProps) {
  const { supabase } = useAuth();
  const showHeaderIcons = UI_ICON_SETTINGS.showHeaderIcons;
  const showSectionHeaderIcons = UI_ICON_SETTINGS.showSectionHeaderIcons;
  const [loading, setLoading] = useState(true);
  const [topTags, setTopTags] = useState<TopTagStat[]>([]);
  const [mostViewedThreads, setMostViewedThreads] = useState<ViewedTopicStat[]>([]);
  const [topLikedPosts, setTopLikedPosts] = useState<TopLikedPost[]>([]);
  const [likedAuthors, setLikedAuthors] = useState<TopLikedAuthor[]>([]);

  useEffect(() => {
    if (!profileId) return;

    const fetchTopFive = async () => {
      setLoading(true);

      const [topTagsRes, viewedThreadsRes, likedPostsRes, likedAuthorsRes] = await Promise.all([
        supabase.rpc('get_profile_top_tags', {
          target_profile_id: profileId,
          result_limit: 5,
        }),
        supabase
          .from('topics')
          .select('id, title, views')
          .eq('author_id', profileId)
          .order('views', { ascending: false })
          .limit(5),
        supabase.rpc('get_profile_top_liked_posts', {
          target_profile_id: profileId,
          result_limit: 5,
        }),
        supabase.rpc('get_profile_top_liked_authors', {
          target_profile_id: profileId,
          result_limit: 5,
        }),
      ]);

      if (!topTagsRes.error && topTagsRes.data) {
        setTopTags(topTagsRes.data as TopTagStat[]);
      } else {
        setTopTags([]);
      }

      if (!viewedThreadsRes.error && viewedThreadsRes.data) {
        setMostViewedThreads(viewedThreadsRes.data as ViewedTopicStat[]);
      } else {
        setMostViewedThreads([]);
      }

      if (!likedPostsRes.error && likedPostsRes.data) {
        setTopLikedPosts(likedPostsRes.data as TopLikedPost[]);
      } else {
        setTopLikedPosts([]);
      }

      if (!likedAuthorsRes.error && likedAuthorsRes.data) {
        setLikedAuthors(likedAuthorsRes.data as TopLikedAuthor[]);
      } else {
        setLikedAuthors([]);
      }

      setLoading(false);
    };

    fetchTopFive();
  }, [profileId, supabase]);

  if (loading) {
    return (
      <Card className={className}>
        <h2 className="card-title flex items-center gap-2">
          {showHeaderIcons && <Star size={20} className="text-yellow-600" />}
          Top 5
        </h2>
        <p className="text-sm text-gray-500">Ladataan...</p>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <h2 className="card-title mb-5 flex items-center gap-2">
        {showHeaderIcons && <Star size={20} className="text-yellow-600" />}
        Top 5
      </h2>

      <div>
        <section className="section-block">
          <h3 className="section-header">
            {showSectionHeaderIcons && <Star size={14} className="text-yellow-600" />}
            Käytetyimmät tagit
          </h3>
          {topTags.length > 0 ? (
            <div className="space-y-2">
              {topTags.map((tag) => (
                <div key={tag.tag_id} className="flex items-center gap-2 text-sm">
                  <span className="text-lg">🏷️</span>
                  <span className="flex-1 font-medium">{tag.tag_name}</span>
                  <span className="text-gray-500">{tag.usage_count} aihetta</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Ei dataa vielä.</p>
          )}
        </section>

        <section className="section-block">
          <h3 className="section-header">
            {showSectionHeaderIcons && <Heart size={14} className="text-yellow-600" />}
            Eniten tykätyt viestit
          </h3>
          {topLikedPosts.length > 0 ? (
            <div className="space-y-2">
              {topLikedPosts.map((post) => (
                <Link
                  key={post.post_id}
                  href={`/forum/topic/${post.topic_id}`}
                  className="block rounded border border-gray-200 bg-gray-50 px-2.5 py-2 hover:bg-yellow-50 transition"
                >
                  <p className="text-xs text-gray-500 truncate mb-1">{post.topic_title}</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{post.content_preview}</p>
                  <p className="text-xs text-yellow-700 mt-1">{post.likes_count} tykkäystä</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Ei tykättyjä viestejä vielä.</p>
          )}
        </section>

        <section className="section-block">
          <h3 className="section-header">
            {showSectionHeaderIcons && <BarChart3 size={14} className="text-yellow-600" />}
            Katsotuimmat aiheet
          </h3>
          {mostViewedThreads.length > 0 ? (
            <div className="space-y-2">
              {mostViewedThreads.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/forum/topic/${topic.id}`}
                  className="flex items-center gap-2 text-sm rounded border border-gray-200 bg-gray-50 px-2.5 py-2 hover:bg-yellow-50 transition"
                >
                  <span className="flex-1 truncate font-medium">{topic.title}</span>
                  <span className="text-gray-500 whitespace-nowrap">{topic.views} katselua</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Ei aiheita vielä.</p>
          )}
        </section>

        <section className="section-block">
          <h3 className="section-header">
            {showSectionHeaderIcons && <Users size={14} className="text-yellow-600" />}
            Käyttäjät joiden viesteistä olet tykännyt
          </h3>
          {likedAuthors.length > 0 ? (
            <div className="space-y-2">
              {likedAuthors.map((author) => (
                <Link
                  key={author.author_id}
                  href={`/profile/${author.author_id}`}
                  className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-2 hover:bg-yellow-50 transition"
                >
                  {author.profile_image_url ? (
                    <img
                      src={profileThumb(author.profile_image_url)}
                      alt={author.username}
                      className="avatar-inline-sm"
                    />
                  ) : (
                    <span className="avatar-inline-sm-fallback text-xs font-bold">
                      {author.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="text-sm font-medium flex-1 truncate">{author.username}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{author.likes_given} tykkäystä</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Et ole tykännyt vielä muiden viesteistä.</p>
          )}
        </section>
      </div>
    </Card>
  );
}
