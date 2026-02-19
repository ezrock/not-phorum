'use client';

import { type Dispatch, type SetStateAction } from 'react';
import type { Topic, TopicPrimaryTag } from '@/components/forum/types';
import { usePostLikes } from '@/hooks/usePostLikes';
import { createClient } from '@/lib/supabase/client';
import type { Post } from '@/components/forum/post';
import { useTopicReply } from '@/hooks/topic/useTopicReply';
import { usePostLinkCopy } from '@/hooks/topic/usePostLinkCopy';
import { useTopicEditDelete } from '@/hooks/topic/useTopicEditDelete';

interface UseTopicPostActionsOptions {
  topicId: number;
  currentUser: { id: string } | null;
  supabase: ReturnType<typeof createClient>;
  topic: Topic | null;
  topicPrimaryTag: TopicPrimaryTag | null;
  posts: Post[];
  totalPosts: number;
  firstPostId: number | null;
  windowEndIndex: number;
  callerIsAdmin: boolean;
  setTopic: Dispatch<SetStateAction<Topic | null>>;
  setTopicPrimaryTag: Dispatch<SetStateAction<TopicPrimaryTag | null>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setTotalPosts: Dispatch<SetStateAction<number>>;
  setWindowEndIndex: Dispatch<SetStateAction<number>>;
  setRefreshTick: Dispatch<SetStateAction<number>>;
  loadAroundPost: (targetPostId: number) => Promise<boolean>;
}

export function useTopicPostActions({
  topicId,
  currentUser,
  supabase,
  topic,
  topicPrimaryTag,
  posts,
  totalPosts,
  firstPostId,
  windowEndIndex,
  callerIsAdmin,
  setTopic,
  setTopicPrimaryTag,
  setPosts,
  setTotalPosts,
  setWindowEndIndex,
  setRefreshTick,
  loadAroundPost,
}: UseTopicPostActionsOptions) {
  const { postLikes, likeSaving, toggleLike, addNewPostLike } = usePostLikes(posts);
  const canEditTopicMeta = !!currentUser && !!topic && (topic.author_id === currentUser.id || callerIsAdmin);

  const { submitting, handleReply } = useTopicReply({
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
  });

  const {
    topicTitleDraft,
    setTopicTitleDraft,
    topicTagDraft,
    setTopicTagDraft,
    topicEditError,
    editingPostId,
    editSaving,
    deleteConfirmId,
    setDeleteConfirmId,
    handleEditSave,
    handleDelete,
    startEdit,
    cancelEdit,
  } = useTopicEditDelete({
    topicId,
    currentUser,
    supabase,
    topic,
    topicPrimaryTag,
    firstPostId,
    canEditTopicMeta,
    setTopic,
    setTopicPrimaryTag,
    setPosts,
    setRefreshTick,
  });

  const { copiedPostId, handleCopyPostLink } = usePostLinkCopy();

  return {
    submitting,
    canEditTopicMeta,
    topicTitleDraft,
    topicTagDraft,
    topicEditError,
    editingPostId,
    editSaving,
    deleteConfirmId,
    copiedPostId,
    postLikes,
    likeSaving,
    handleReply,
    handleEditSave,
    handleDelete,
    handleCopyPostLink,
    setDeleteConfirmId,
    setTopicTitleDraft,
    setTopicTagDraft,
    startEdit,
    cancelEdit,
    toggleLike,
  };
}
