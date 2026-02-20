'use client';

import { useTopicPostsWindow } from '@/hooks/topic/useTopicPostsWindow';
import { useTopicPostActions } from '@/hooks/topic/useTopicPostActions';
import { createClient } from '@/lib/supabase/client';

interface UseTopicPageDataOptions {
  topicId: number;
  currentUser: { id: string } | null;
  supabase: ReturnType<typeof createClient>;
  profile: { is_admin?: boolean; realtime_updates_enabled?: boolean; legacy_tag_icons_enabled?: boolean } | null;
}

export function useTopicPageData({ topicId, currentUser, supabase, profile }: UseTopicPageDataOptions) {
  const postsWindow = useTopicPostsWindow({
    topicId,
    currentUser,
    supabase,
    profile,
  });

  const callerIsAdmin = profile?.is_admin === true;

  const postActions = useTopicPostActions({
    topicId,
    currentUser,
    supabase,
    topic: postsWindow.topic,
    topicPrimaryTag: postsWindow.topicPrimaryTag,
    posts: postsWindow.posts,
    totalPosts: postsWindow.totalPosts,
    firstPostId: postsWindow.firstPostId,
    windowEndIndex: postsWindow.windowEndIndex,
    callerIsAdmin,
    setTopic: postsWindow.setTopic,
    setTopicPrimaryTag: postsWindow.setTopicPrimaryTag,
    setPosts: postsWindow.setPosts,
    setTotalPosts: postsWindow.setTotalPosts,
    setWindowEndIndex: postsWindow.setWindowEndIndex,
    setRefreshTick: postsWindow.setRefreshTick,
    loadAroundPost: postsWindow.loadAroundPost,
  });

  return {
    topic: postsWindow.topic,
    topicPrimaryTag: postsWindow.topicPrimaryTag,
    posts: postsWindow.posts,
    totalPosts: postsWindow.totalPosts,
    firstPostId: postsWindow.firstPostId,
    loading: postsWindow.loading,
    loadingMore: postsWindow.loadingMore,
    displayedPostCount: postsWindow.displayedPostCount,
    canLoadOlder: postsWindow.canLoadOlder,
    canShowMore: postsWindow.canShowMore,
    highlightedPostId: postsWindow.highlightedPostId,
    loadOlderPosts: postsWindow.loadOlderPosts,
    handleShowMore: postsWindow.handleShowMore,
    callerIsAdmin,
    ...postActions,
  };
}
