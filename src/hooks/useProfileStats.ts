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

export function useProfileStats(userId: string | null) {
  const { supabase } = useAuth();
  const [postCount, setPostCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [mostPopularTopic, setMostPopularTopic] = useState<TopicStat | null>(null);
  const [mostActiveTopic, setMostActiveTopic] = useState<TopicStat | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      const [postsRes, topicsRes, popularRes, activeRes, trophiesRes] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('topics').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('topics').select('id, title, views, reply_count').eq('author_id', userId).order('views', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('topics').select('id, title, views, reply_count').eq('author_id', userId).order('reply_count', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('profile_trophies').select('trophy:trophies(id, code, name, points, icon_path)').eq('profile_id', userId),
      ]);

      setPostCount(postsRes.count || 0);
      setTopicCount(topicsRes.count || 0);
      if (popularRes.data) setMostPopularTopic(popularRes.data as TopicStat);
      if (activeRes.data) setMostActiveTopic(activeRes.data as TopicStat);
      if (trophiesRes.data) setTrophies(parseTrophies(trophiesRes.data as TrophyJoinRow[]));
    };

    fetchStats();
  }, [supabase, userId]);

  return { postCount, topicCount, trophies, mostPopularTopic, mostActiveTopic };
}
