'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Post } from '@/components/forum/PostItem';
import type { Topic, TopicPrimaryTag } from '@/components/forum/types';
import type { TagOption } from '@/components/forum/AddTags';
import { usePostLikes } from '@/hooks/usePostLikes';
import { createClient } from '@/lib/supabase/client';

type SupabaseJoinField<T> = T | T[] | null;

interface RawPostRow {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author: SupabaseJoinField<Post['author']>;
}

interface EditTopicFirstPostRow {
  topic_id: number;
  topic_title: string;
  post_id: number;
  post_content: string;
  post_image_url: string | null;
  tag_id: number;
  tag_name: string;
  tag_slug: string;
  tag_icon: string;
}

function normalizeJoin<T>(value: SupabaseJoinField<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function parsePost(row: RawPostRow): Post {
  return { ...row, author: normalizeJoin(row.author) ?? null };
}

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
  const [submitting, setSubmitting] = useState(false);
  const [topicTitleDraft, setTopicTitleDraft] = useState('');
  const [topicTagDraft, setTopicTagDraft] = useState<TagOption[]>([]);
  const [topicEditError, setTopicEditError] = useState('');
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const { postLikes, likeSaving, toggleLike, addNewPostLike } = usePostLikes(posts);
  const canEditTopicMeta = !!currentUser && !!topic && (topic.author_id === currentUser.id || callerIsAdmin);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

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
      const insertedPost = parsePost(data as RawPostRow);
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
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  const handleEditSave = async (postId: number, content: string, imageUrl: string) => {
    if (!content.trim() || !currentUser) return;

    if (postId === firstPostId && canEditTopicMeta) {
      const normalizedTitle = topicTitleDraft.trim();
      if (normalizedTitle.length < 3) {
        setTopicEditError('Otsikon pitää olla vähintään 3 merkkiä');
        return;
      }

      setEditSaving(true);
      setTopicEditError('');

      const selectedTagId = topicTagDraft[0]?.id ?? null;
      const { data, error } = await supabase.rpc('edit_topic_first_post_details', {
        input_topic_id: topicId,
        input_title: normalizedTitle,
        input_content: content.trim(),
        input_image_url: imageUrl || null,
        input_tag_id: selectedTagId,
      });

      if (error) {
        setTopicEditError(error.message || 'Langan päivitys epäonnistui');
        setEditSaving(false);
        return;
      }

      const row = Array.isArray(data) && data.length > 0 ? (data[0] as EditTopicFirstPostRow) : null;
      if (row) {
        setTopic((prev) => (prev ? { ...prev, title: row.topic_title } : prev));
        setTopicPrimaryTag({
          id: row.tag_id,
          name: row.tag_name,
          slug: row.tag_slug,
          icon: row.tag_icon || '🏷️',
        });
        setPosts((prev) =>
          prev.map((p) =>
            p.id === row.post_id
              ? { ...p, content: row.post_content, image_url: row.post_image_url, updated_at: new Date().toISOString() }
              : p
          )
        );
      } else {
        setRefreshTick((prev) => prev + 1);
      }

      setEditingPostId(null);
      setEditSaving(false);
      return;
    }

    setEditSaving(true);

    const { data, error } = await supabase
      .from('posts')
      .update({
        content: content.trim(),
        image_url: imageUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('author_id', currentUser.id)
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, profile_image_url, created_at)
      `)
      .single();

    if (!error && data) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? parsePost(data as RawPostRow) : p)));
      setEditingPostId(null);
    }
    setEditSaving(false);
  };

  const handleDelete = async (postId: number) => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('author_id', currentUser.id)
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, profile_image_url, created_at)
      `)
      .single();

    if (!error && data) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? parsePost(data as RawPostRow) : p)));
    }
    setDeleteConfirmId(null);
  };

  const handleCopyPostLink = async (postId: number) => {
    if (typeof window === 'undefined') return;

    const linkUrl = new URL(window.location.href);
    linkUrl.hash = `post-${postId}`;
    const linkText = linkUrl.toString();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = linkText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedPostId(postId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedPostId((prev) => (prev === postId ? null : prev));
        copyTimeoutRef.current = null;
      }, 1200);
    } catch {
      // no-op
    }
  };

  const startEdit = (post: Post) => {
    if (post.id === firstPostId && canEditTopicMeta && topic) {
      setTopicTitleDraft(topic.title);
      setTopicTagDraft(
        topicPrimaryTag
          ? [
              {
                id: topicPrimaryTag.id,
                name: topicPrimaryTag.name,
                slug: topicPrimaryTag.slug,
                icon: topicPrimaryTag.icon,
              },
            ]
          : []
      );
      setTopicEditError('');
    }
    setEditingPostId(post.id);
  };

  const cancelEdit = (post: Post) => {
    setEditingPostId(null);
    if (post.id === firstPostId) {
      setTopicEditError('');
    }
  };

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
