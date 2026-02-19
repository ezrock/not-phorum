'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/lib/supabase/client';
import { parsePostRow, type RawPostRow } from '@/lib/forum/parsers';
import type { Topic, TopicPrimaryTag } from '@/components/forum/types';
import type { TagOption } from '@/components/forum/AddTags';
import type { Post } from '@/components/forum/post';

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

interface UseTopicEditDeleteOptions {
  topicId: number;
  currentUser: { id: string } | null;
  supabase: ReturnType<typeof createClient>;
  topic: Topic | null;
  topicPrimaryTag: TopicPrimaryTag | null;
  firstPostId: number | null;
  canEditTopicMeta: boolean;
  setTopic: Dispatch<SetStateAction<Topic | null>>;
  setTopicPrimaryTag: Dispatch<SetStateAction<TopicPrimaryTag | null>>;
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setRefreshTick: Dispatch<SetStateAction<number>>;
}

export function useTopicEditDelete({
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
}: UseTopicEditDeleteOptions) {
  const [topicTitleDraft, setTopicTitleDraft] = useState('');
  const [topicTagDraft, setTopicTagDraft] = useState<TagOption[]>([]);
  const [topicEditError, setTopicEditError] = useState('');
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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
      setPosts((prev) => prev.map((p) => (p.id === postId ? parsePostRow(data as RawPostRow) : p)));
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
      setPosts((prev) => prev.map((p) => (p.id === postId ? parsePostRow(data as RawPostRow) : p)));
    }
    setDeleteConfirmId(null);
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
  };
}
