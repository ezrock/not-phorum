'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { POSTS_PER_PAGE } from '@/lib/pagination';
import { PostItem } from '@/components/forum/PostItem';
import type { Post } from '@/components/forum/PostItem';
import { ReplyForm } from '@/components/forum/ReplyForm';
import { TopicPagination } from '@/components/forum/TopicPagination';
import { usePostLikes } from '@/hooks/usePostLikes';

interface Topic {
  id: number;
  title: string;
  views: number;
  views_total: number | null;
  views_unique: number | null;
}

interface TopicViewResponse {
  views_total?: number;
  views_unique?: number;
}

function parseTopicViewResponse(value: unknown): TopicViewResponse | null {
  if (!value || typeof value !== 'object') return null;
  return value as TopicViewResponse;
}

// Supabase join results may return related rows as object or array.
// These helpers normalize the shape to match our interfaces.
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
  views: number;
  views_total: number | null;
  views_unique: number | null;
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

function TopicContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, supabase, profile } = useAuth();
  const topicId = parseInt(params.id as string);
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageOffset = (currentPage - 1) * POSTS_PER_PAGE;
  const realtimeUpdatesEnabled = (profile as { realtime_updates_enabled?: boolean } | null)?.realtime_updates_enabled === true;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [firstPostId, setFirstPostId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const highlightTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const { postLikes, likeSaving, toggleLike, addNewPostLike } = usePostLikes(posts);

  useEffect(() => {
    const fetchData = async () => {
      const [topicRes, postsRes, countRes, firstPostRes] = await Promise.all([
        supabase
          .from('topics')
          .select('id, title, views, views_total, views_unique')
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
          .range(pageOffset, pageOffset + POSTS_PER_PAGE - 1),
        supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', topicId),
        supabase
          .from('posts')
          .select('id')
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true })
          .limit(1),
      ]);

      if (!topicRes.error && topicRes.data) {
        setTopic(parseTopic(topicRes.data as RawTopicRow));
      }
      if (!postsRes.error && postsRes.data) {
        setPosts((postsRes.data as RawPostRow[]).map(parsePost));
      }
      if (!countRes.error) {
        setTotalPosts(countRes.count || 0);
      }
      if (!firstPostRes.error && firstPostRes.data && firstPostRes.data.length > 0) {
        setFirstPostId(firstPostRes.data[0].id as number);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase, topicId, pageOffset, refreshTick]);

  useEffect(() => {
    if (!currentUser || !realtimeUpdatesEnabled || !Number.isFinite(topicId)) return;

    const channel = supabase
      .channel(`topic-live-${topicId}-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `topic_id=eq.${topicId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const insertedPostId =
              payload.new && typeof payload.new === 'object' && 'id' in payload.new
                ? Number((payload.new as { id?: number }).id)
                : null;
            const { count } = await supabase
              .from('posts')
              .select('id', { count: 'exact', head: true })
              .eq('topic_id', topicId);
            const nextTotalPosts = count || 0;
            const latestPage = Math.max(1, Math.ceil(nextTotalPosts / POSTS_PER_PAGE));

            if (latestPage !== currentPage) {
              const target = latestPage <= 1 ? `/forum/topic/${topicId}` : `/forum/topic/${topicId}?page=${latestPage}`;
              router.replace(insertedPostId ? `${target}#post-${insertedPostId}` : target);
              return;
            }
          }

          setRefreshTick((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, topicId, currentPage, currentUser, realtimeUpdatesEnabled, router]);

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

    trackView();
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
      if (!Number.isFinite(postIdFromHash) || !posts.some((post) => post.id === postIdFromHash)) {
        return;
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
  }, [posts]);

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
      const insertedPost = parsePost(data as RawPostRow);
      const nextTotalPosts = totalPosts + 1;
      const nextPage = Math.max(1, Math.ceil(nextTotalPosts / POSTS_PER_PAGE));

      if (nextPage === currentPage) {
        setPosts((prev) => [...prev, insertedPost]);
        setTotalPosts(nextTotalPosts);
        addNewPostLike(insertedPost.id);
        window.location.hash = `post-${insertedPost.id}`;
        setSubmitting(false);
        return;
      }

      router.push(`/forum/topic/${topicId}${nextPage > 1 ? `?page=${nextPage}` : ''}#post-${insertedPost.id}`);
      return;
    }
    setSubmitting(false);
  };

  const handleEditSave = async (postId: number, content: string, imageUrl: string) => {
    if (!content.trim() || !currentUser) return;
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

  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <h2 className="text-2xl font-bold">Aihetta ei löytynyt</h2>
          <Link href="/forum">
            <Button className="mt-4">Takaisin foorumille</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 mb-12">
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-4xl">🏷️</span>
            <div>
              <h1 className="text-3xl font-bold mb-2">{topic.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="text-yellow-800 font-medium">Tagit</span>
                <span>{topic.views_unique ?? topic.views} katselua</span>
                <span>{totalPosts} viestiä</span>
              </div>
            </div>
          </div>
          <Link href="/forum">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft size={16} />
              Takaisin
            </Button>
          </Link>
        </div>

        <div className="mt-6 border-t border-gray-200">
          {posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              isOriginalPost={post.id === firstPostId}
              isHighlighted={highlightedPostId === post.id}
              currentUserId={currentUser?.id ?? null}
              isEditing={editingPostId === post.id}
              onStartEdit={() => setEditingPostId(post.id)}
              onCancelEdit={() => setEditingPostId(null)}
              onSave={handleEditSave}
              editSaving={editSaving}
              isConfirmingDelete={deleteConfirmId === post.id}
              onRequestDelete={() => setDeleteConfirmId(post.id)}
              onConfirmDelete={() => handleDelete(post.id)}
              onCancelDelete={() => setDeleteConfirmId(null)}
              likeState={postLikes[post.id] || { count: 0, likedByMe: false }}
              likeSaving={!!likeSaving[post.id]}
              onToggleLike={() => toggleLike(post.id)}
              isCopied={copiedPostId === post.id}
              onCopyLink={() => handleCopyPostLink(post.id)}
            />
          ))}
        </div>

        <TopicPagination currentPage={currentPage} totalPages={totalPages} topicId={topicId} />
      </Card>

      {currentUser ? (
        <ReplyForm onSubmit={handleReply} submitting={submitting} />
      ) : (
        <Card className="mt-6 text-center">
          <p className="text-gray-600 mb-4">
            Kirjaudu sisään vastataksesi tähän aiheeseen
          </p>
          <Link href="/login">
            <Button>Kirjaudu sisään</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}

export default function TopicPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto mt-8 px-4"><Card><p className="text-center text-gray-500 py-8">Ladataan...</p></Card></div>}>
      <TopicContent />
    </Suspense>
  );
}
