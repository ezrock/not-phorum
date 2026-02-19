'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Post } from '@/components/forum/PostItem';
import type { TagOption } from '@/components/forum/AddTags';
import { usePostLikes } from '@/hooks/usePostLikes';
import { UI_PAGING_SETTINGS } from '@/lib/uiSettings';
import { createClient } from '@/lib/supabase/client';

export interface Topic {
  id: number;
  title: string;
  author_id: string;
  views: number;
  views_total: number | null;
  views_unique: number | null;
}

export interface TopicPrimaryTag {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

interface TopicViewResponse {
  views_total?: number;
  views_unique?: number;
}

function parseTopicViewResponse(value: unknown): TopicViewResponse | null {
  if (!value || typeof value !== 'object') return null;
  return value as TopicViewResponse;
}

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

interface RawTopicRow {
  id: number;
  title: string;
  author_id: string;
  views: number;
  views_total: number | null;
  views_unique: number | null;
}

interface RawTopicTagRow {
  tag:
    | {
        id?: number | null;
        name?: string | null;
        slug?: string | null;
        icon?: string | null;
        status?: string | null;
        redirect_to_tag_id?: number | null;
      }
    | {
        id?: number | null;
        name?: string | null;
        slug?: string | null;
        icon?: string | null;
        status?: string | null;
        redirect_to_tag_id?: number | null;
      }[]
    | null;
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

interface AroundPostRow {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author_id: string | null;
  author_username: string | null;
  author_profile_image_url: string | null;
  author_created_at: string | null;
  author_signature: string | null;
  author_show_signature: boolean | null;
  post_row_number: number;
  total_rows: number;
}

function normalizeJoin<T>(value: SupabaseJoinField<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function parsePost(row: RawPostRow): Post {
  return { ...row, author: normalizeJoin(row.author) ?? null };
}

function parseTopic(row: RawTopicRow): Topic {
  return { ...row };
}

function parseAroundPost(row: AroundPostRow): Post {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    image_url: row.image_url,
    author: row.author_id
      ? {
          id: row.author_id,
          username: row.author_username || 'tuntematon',
          profile_image_url: row.author_profile_image_url,
          created_at: row.author_created_at || row.created_at,
          signature: row.author_signature,
          show_signature: row.author_show_signature === true,
        }
      : null,
  };
}

interface UseTopicPageDataOptions {
  topicId: number;
  currentUser: { id: string } | null;
  supabase: ReturnType<typeof createClient>;
  profile: { is_admin?: boolean; realtime_updates_enabled?: boolean } | null;
}

export function useTopicPageData({ topicId, currentUser, supabase, profile }: UseTopicPageDataOptions) {
  const initialVisibleMessages = UI_PAGING_SETTINGS.threadInitialVisibleMessages;
  const showMoreStep = UI_PAGING_SETTINGS.threadShowMoreStep;
  const anchorBeforeBuffer = UI_PAGING_SETTINGS.threadAnchorBeforeBuffer;
  const anchorAfterBuffer = UI_PAGING_SETTINGS.threadAnchorAfterBuffer;
  const realtimeUpdatesEnabled = profile?.realtime_updates_enabled === true;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [topicPrimaryTag, setTopicPrimaryTag] = useState<TopicPrimaryTag | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [firstPostId, setFirstPostId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [windowStartIndex, setWindowStartIndex] = useState(0);
  const [windowEndIndex, setWindowEndIndex] = useState(0);
  const [topicTitleDraft, setTopicTitleDraft] = useState('');
  const [topicTagDraft, setTopicTagDraft] = useState<TagOption[]>([]);
  const [topicEditError, setTopicEditError] = useState('');

  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const highlightTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const { postLikes, likeSaving, toggleLike, addNewPostLike } = usePostLikes(posts);
  const callerIsAdmin = profile?.is_admin === true;
  const canEditTopicMeta = !!currentUser && !!topic && (topic.author_id === currentUser.id || callerIsAdmin);

  const loadMorePosts = useCallback(
    async (targetEndIndex?: number) => {
      const desiredEnd = Math.min(
        totalPosts,
        Math.max(windowEndIndex + showMoreStep, targetEndIndex ?? windowEndIndex + showMoreStep)
      );
      if (desiredEnd <= windowEndIndex) return;

      setLoadingMore(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, profile_image_url, created_at, signature, show_signature)
      `)
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true })
        .range(windowEndIndex, desiredEnd - 1);

      if (!error && data && data.length > 0) {
        const parsed = (data as RawPostRow[]).map(parsePost);
        setPosts((prev) => [...prev, ...parsed]);
        setWindowEndIndex((prev) => prev + parsed.length);
      }
      setLoadingMore(false);
    },
    [showMoreStep, supabase, topicId, totalPosts, windowEndIndex]
  );

  const loadOlderPosts = useCallback(async () => {
    if (windowStartIndex <= 0) return;
    const nextStart = Math.max(0, windowStartIndex - showMoreStep);
    const nextEnd = windowStartIndex - 1;
    if (nextEnd < nextStart) return;

    setLoadingMore(true);
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, profile_image_url, created_at, signature, show_signature)
      `)
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .range(nextStart, nextEnd);

    if (!error && data && data.length > 0) {
      const parsed = (data as RawPostRow[]).map(parsePost);
      setPosts((prev) => [...parsed, ...prev]);
      setWindowStartIndex(nextStart);
    }
    setLoadingMore(false);
  }, [showMoreStep, supabase, topicId, windowStartIndex]);

  const loadAroundPost = useCallback(
    async (targetPostId: number) => {
      if (!Number.isFinite(targetPostId) || targetPostId <= 0) return false;

      setLoadingMore(true);
      const { data, error } = await supabase.rpc('get_topic_posts_around', {
        input_topic_id: topicId,
        input_post_id: targetPostId,
        input_before: anchorBeforeBuffer,
        input_after: anchorAfterBuffer,
      });

      if (error || !data || data.length === 0) {
        setLoadingMore(false);
        return false;
      }

      const rows = data as AroundPostRow[];
      const parsed = rows.map(parseAroundPost);
      const firstRowNumber = rows[0]?.post_row_number ?? 1;
      const lastRowNumber = rows[rows.length - 1]?.post_row_number ?? firstRowNumber;
      const nextTotalPosts = rows[0]?.total_rows ?? totalPosts;

      setPosts(parsed);
      setWindowStartIndex(Math.max(0, firstRowNumber - 1));
      setWindowEndIndex(lastRowNumber);
      setTotalPosts(nextTotalPosts);
      setLoadingMore(false);
      return true;
    },
    [anchorAfterBuffer, anchorBeforeBuffer, supabase, topicId, totalPosts]
  );

  useEffect(() => {
    const fetchData = async () => {
      if (!Number.isFinite(topicId) || topicId <= 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const initialLoadCount = initialVisibleMessages;
      const [topicRes, postsRes, countRes, firstPostRes, topicTagsRes] = await Promise.all([
        supabase
          .from('topics')
          .select('id, title, author_id, views, views_total, views_unique')
          .eq('id', topicId)
          .single(),
        supabase
          .from('posts')
          .select(`
            id, content, created_at, updated_at, deleted_at, image_url,
            author:profiles!author_id(id, username, profile_image_url, created_at, signature, show_signature)
          `)
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true })
          .range(0, Math.max(initialLoadCount - 1, 0)),
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('topic_id', topicId),
        supabase.from('posts').select('id').eq('topic_id', topicId).order('created_at', { ascending: true }).limit(1),
        supabase
          .from('topic_tags')
          .select('tag:tags(id, name, slug, icon, status, redirect_to_tag_id)')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true }),
      ]);

      if (!topicRes.error && topicRes.data) {
        setTopic(parseTopic(topicRes.data as RawTopicRow));
      }
      if (!postsRes.error && postsRes.data) {
        const parsedPosts = (postsRes.data as RawPostRow[]).map(parsePost);
        setPosts(parsedPosts);
        setWindowStartIndex(0);
        setWindowEndIndex(parsedPosts.length);
      }
      if (!countRes.error) {
        setTotalPosts(countRes.count || 0);
      }
      if (!firstPostRes.error && firstPostRes.data && firstPostRes.data.length > 0) {
        setFirstPostId(firstPostRes.data[0].id as number);
      }
      if (!topicTagsRes.error) {
        const normalizedPrimaryTag = ((topicTagsRes.data || []) as RawTopicTagRow[])
          .map((row) => normalizeJoin(row.tag))
          .find((tag) => !!tag && tag.redirect_to_tag_id == null && tag.status !== 'hidden');

        if (normalizedPrimaryTag && normalizedPrimaryTag.id) {
          setTopicPrimaryTag({
            id: normalizedPrimaryTag.id,
            name: normalizedPrimaryTag.name || 'Tagit',
            slug: normalizedPrimaryTag.slug || '',
            icon: normalizedPrimaryTag.icon?.trim() || '🏷️',
          });
        } else {
          setTopicPrimaryTag(null);
        }
      }
      setLoading(false);
    };

    void fetchData();
  }, [supabase, topicId, refreshTick, initialVisibleMessages]);

  useEffect(() => {
    if (!currentUser || !realtimeUpdatesEnabled || !Number.isFinite(topicId)) return;

    const channel = supabase
      .channel(`topic-live-${topicId}-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `topic_id=eq.${topicId}` },
        () => {
          setRefreshTick((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, topicId, currentUser, realtimeUpdatesEnabled]);

  useEffect(() => {
    if (!Number.isFinite(topicId)) return;

    const trackView = async () => {
      const { data, error } = await supabase.rpc('record_topic_view', {
        target_topic_id: topicId,
      });

      if (!error) {
        const parsed = parseTopicViewResponse(data);
        if (parsed) {
          setTopic((prev) => {
            if (!prev) return prev;
            const nextUnique = typeof parsed.views_unique === 'number' ? parsed.views_unique : prev.views_unique;
            const nextTotal = typeof parsed.views_total === 'number' ? parsed.views_total : prev.views_total;
            return {
              ...prev,
              views_unique: nextUnique,
              views_total: nextTotal,
              views: nextUnique ?? prev.views,
            };
          });
        }
      }
    };

    void trackView();
  }, [supabase, topicId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clearHighlightTimer = () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };

    const applyHashHighlight = () => {
      const match = window.location.hash.match(/^#post-(\d+)$/);
      if (!match) return;

      const postIdFromHash = Number(match[1]);
      if (!Number.isFinite(postIdFromHash)) {
        return;
      }

      if (!posts.some((post) => post.id === postIdFromHash)) {
        void loadAroundPost(postIdFromHash);
        return;
      }

      const targetElement = document.getElementById(`post-${postIdFromHash}`);
      if (targetElement) {
        targetElement.scrollIntoView({ block: 'center', behavior: 'auto' });
      }

      setHighlightedPostId(postIdFromHash);
      clearHighlightTimer();
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedPostId((prev) => (prev === postIdFromHash ? null : prev));
        highlightTimeoutRef.current = null;
      }, 1800);
    };

    applyHashHighlight();
    window.addEventListener('hashchange', applyHashHighlight);

    return () => {
      window.removeEventListener('hashchange', applyHashHighlight);
      clearHighlightTimer();
    };
  }, [posts, loadAroundPost]);

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
      // no-op: copying may fail on unsupported browsers/contexts
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

  const displayedPostCount = posts.length;
  const canLoadOlder = windowStartIndex > 0;
  const canShowMore = windowEndIndex < totalPosts;

  const handleShowMore = async () => {
    await loadMorePosts();
  };

  return {
    topic,
    topicPrimaryTag,
    posts,
    totalPosts,
    firstPostId,
    loading,
    loadingMore,
    submitting,
    displayedPostCount,
    canLoadOlder,
    canShowMore,
    callerIsAdmin,
    canEditTopicMeta,
    editingPostId,
    editSaving,
    deleteConfirmId,
    copiedPostId,
    highlightedPostId,
    topicTitleDraft,
    topicTagDraft,
    topicEditError,
    postLikes,
    likeSaving,
    loadOlderPosts,
    handleShowMore,
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
