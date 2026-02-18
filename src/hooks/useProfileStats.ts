import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { parseTrophies } from '@/lib/trophies';
import type { Trophy, TrophyJoinRow } from '@/lib/trophies';

export interface TopicStat {
  id: number;
  title: string;
  views: number;
  reply_count: number;
}

export interface TopTagStat {
  tag_id: number;
  tag_name: string;
  tag_slug: string;
  usage_count: number;
}

export function useProfileStats(userId: string | null) {
  const { supabase } = useAuth();
  const [postCount, setPostCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [mostPopularTopic, setMostPopularTopic] = useState<TopicStat | null>(null);
  const [mostActiveTopic, setMostActiveTopic] = useState<TopicStat | null>(null);
  const [topTags, setTopTags] = useState<TopTagStat[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      const [postsRes, topicsRes, popularRes, activeRes, trophiesRes, topTagsRes] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('topics').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('topics').select('id, title, views, reply_count').eq('author_id', userId).order('views', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('topics').select('id, title, views, reply_count').eq('author_id', userId).order('reply_count', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('profile_trophies').select('trophy:trophies(id, code, name, points, icon_path)').eq('profile_id', userId),
        supabase.rpc('get_profile_top_tags', { target_profile_id: userId, result_limit: 5 }),
      ]);

      setPostCount(postsRes.count || 0);
      setTopicCount(topicsRes.count || 0);
      if (popularRes.data) setMostPopularTopic(popularRes.data as TopicStat);
      if (activeRes.data) setMostActiveTopic(activeRes.data as TopicStat);
      if (trophiesRes.data) setTrophies(parseTrophies(trophiesRes.data as TrophyJoinRow[]));
      if (!topTagsRes.error && topTagsRes.data) setTopTags(topTagsRes.data as TopTagStat[]);
    };

    fetchStats();
  }, [supabase, userId]);

  return { postCount, topicCount, trophies, mostPopularTopic, mostActiveTopic, topTags };
}
