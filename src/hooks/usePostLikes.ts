import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PostLikeRow {
  post_id: number;
}

export interface PostLikeState {
  count: number;
  likedByMe: boolean;
}

export function usePostLikes(posts: { id: number }[]) {
  const { currentUser, supabase } = useAuth();
  const [postLikes, setPostLikes] = useState<Record<number, PostLikeState>>({});
  const [likeSaving, setLikeSaving] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchLikes = async () => {
      if (!posts.length) {
        setPostLikes({});
        return;
      }

      const postIds = posts.map((post) => post.id);

      const countsReq = supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', postIds);

      const myLikesReq = currentUser
        ? supabase
            .from('post_likes')
            .select('post_id')
            .eq('profile_id', currentUser.id)
            .in('post_id', postIds)
        : Promise.resolve({ data: [], error: null });

      const [countsRes, myLikesRes] = await Promise.all([countsReq, myLikesReq]);

      const countsMap: Record<number, number> = {};
      if (!countsRes.error && countsRes.data) {
        for (const row of countsRes.data as PostLikeRow[]) {
          countsMap[row.post_id] = (countsMap[row.post_id] || 0) + 1;
        }
      }

      const likedByMeSet = new Set<number>();
      if (!myLikesRes.error && myLikesRes.data) {
        for (const row of myLikesRes.data as PostLikeRow[]) {
          likedByMeSet.add(row.post_id);
        }
      }

      const nextState: Record<number, PostLikeState> = {};
      for (const postId of postIds) {
        nextState[postId] = {
          count: countsMap[postId] || 0,
          likedByMe: likedByMeSet.has(postId),
        };
      }
      setPostLikes(nextState);
    };

    fetchLikes();
  }, [supabase, currentUser, posts]);

  const toggleLike = async (postId: number) => {
    if (!currentUser || likeSaving[postId]) return;

    const current = postLikes[postId] || { count: 0, likedByMe: false };
    setLikeSaving((prev) => ({ ...prev, [postId]: true }));

    if (current.likedByMe) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('profile_id', currentUser.id);

      if (!error) {
        setPostLikes((prev) => ({
          ...prev,
          [postId]: {
            count: Math.max((prev[postId]?.count || 0) - 1, 0),
            likedByMe: false,
          },
        }));
      }
    } else {
      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          profile_id: currentUser.id,
        });

      if (!error) {
        setPostLikes((prev) => ({
          ...prev,
          [postId]: {
            count: (prev[postId]?.count || 0) + 1,
            likedByMe: true,
          },
        }));
      }
    }

    setLikeSaving((prev) => ({ ...prev, [postId]: false }));
  };

  const addNewPostLike = (postId: number) => {
    setPostLikes((prev) => ({
      ...prev,
      [postId]: { count: 0, likedByMe: false },
    }));
  };

  return { postLikes, likeSaving, toggleLike, addNewPostLike };
}
