'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parsePostRow, type RawPostRow } from '@/lib/forum/parsers';

interface UseTopicReplyOptions {
  topicId: number;
  currentUser: { id: string } | null;
  supabase: ReturnType<typeof createClient>;
  totalPosts: number;
  windowEndIndex: number;
  setPosts: Dispatch<SetStateAction<import('@/components/forum/post').Post[]>>;
  setTotalPosts: Dispatch<SetStateAction<number>>;
  setWindowEndIndex: Dispatch<SetStateAction<number>>;
  loadAroundPost: (targetPostId: number) => Promise<boolean>;
  addNewPostLike: (postId: number) => void;
}

export function useTopicReply({
  topicId,
  currentUser,
  supabase,
  totalPosts,
  windowEndIndex,
  setPosts,
  setTotalPosts,
  setWindowEndIndex,
  loadAroundPost,
  addNewPostLike,
}: UseTopicReplyOptions) {
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async (content: string, imageUrl: string) => {
    if (!content.trim() || !currentUser) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        topic_id: topicId,
        author_id: currentUser.id,
        content: content.trim(),
        image_url: imageUrl || null,
      })
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, profile_image_url, created_at)
      `)
      .single();

    if (!error && data) {
      const nextTotalPosts = totalPosts + 1;
      const insertedPost = parsePostRow(data as RawPostRow);
      const hasLatestLoaded = windowEndIndex >= totalPosts;

      setTotalPosts(nextTotalPosts);
      addNewPostLike(insertedPost.id);
      if (hasLatestLoaded) {
        setPosts((prev) => [...prev, insertedPost]);
        setWindowEndIndex((prev) => prev + 1);
      } else {
        await loadAroundPost(insertedPost.id);
      }
      window.location.hash = `post-${insertedPost.id}`;
    }

    setSubmitting(false);
  };

  return {
    submitting,
    handleReply,
  };
}
