'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Edit2, ImagePlus, X, Trash2, Save, User, Heart, Link2, Check } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CldUploadWidget } from 'next-cloudinary';
import { profileThumb, postImage, postThumb } from '@/lib/cloudinary';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import LinkifyIt from 'linkify-it';
import tlds from 'tlds';
import { POSTS_PER_PAGE } from '@/lib/pagination';
import { formatPostDateTime } from '@/lib/formatDate';

interface Post {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
    created_at: string;
    signature: string | null;
    show_signature: boolean;
  } | null;
}

interface Topic {
  id: number;
  title: string;
  views: number;
  views_total: number | null;
  views_unique: number | null;
  category: { name: string; icon: string } | null;
}

interface CloudinaryUploadResult {
  info?: {
    secure_url?: string;
  };
}

interface TopicViewResponse {
  views_total?: number;
  views_unique?: number;
}

interface PostLikeRow {
  post_id: number;
}

interface PostLikeState {
  count: number;
  likedByMe: boolean;
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
  category: SupabaseJoinField<{ name: string; icon: string }>;
}

function normalizeJoin<T>(value: SupabaseJoinField<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function parsePost(row: RawPostRow): Post {
  return { ...row, author: normalizeJoin(row.author) ?? null };
}

function parseTopic(row: RawTopicRow): Topic {
  return { ...row, category: normalizeJoin(row.category) ?? null };
}

function extractSecureUrl(result: unknown): string | null {
  const typed = result as CloudinaryUploadResult;
  return typed?.info?.secure_url ?? null;
}

const URL_MAX_DISPLAY_LENGTH = 60;
const linkify = new LinkifyIt();
linkify.set({ fuzzyLink: true, fuzzyIP: false, fuzzyEmail: false });
linkify.tlds(tlds as string[]);

function shortenUrlDisplay(url: string): string {
  if (url.length <= URL_MAX_DISPLAY_LENGTH) return url;
  return `${url.slice(0, URL_MAX_DISPLAY_LENGTH - 3)}...`;
}

function ensureUrlProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function parseYouTubeVideoId(rawUrl: string): string | null {
  try {
    const normalized = ensureUrlProtocol(rawUrl);
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0] || '';
      return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') {
        const candidate = url.searchParams.get('v') || '';
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }

      if (url.pathname.startsWith('/shorts/')) {
        const candidate = url.pathname.split('/')[2] || '';
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }

      if (url.pathname.startsWith('/embed/')) {
        const candidate = url.pathname.split('/')[2] || '';
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function extractYouTubeEmbedUrls(text: string): string[] {
  const matches = linkify.match(text);
  if (!matches || matches.length === 0) return [];

  const videoIds = new Set<string>();
  for (const match of matches) {
    const videoId = parseYouTubeVideoId(match.url || match.raw);
    if (videoId) {
      videoIds.add(videoId);
    }
  }

  return Array.from(videoIds).map((videoId) => `https://www.youtube-nocookie.com/embed/${videoId}`);
}

function autoLinkPlainUrls(markdown: string): string {
  const matches = linkify.match(markdown);
  if (!matches || matches.length === 0) return markdown;

  let result = '';
  let cursor = 0;

  for (const match of matches) {
    const start = match.index;
    const end = match.lastIndex;
    const raw = match.raw;
    const href = ensureUrlProtocol(match.url || raw);

    result += markdown.slice(cursor, start);
    result += `[${shortenUrlDisplay(raw)}](${href})`;
    cursor = end;
  }

  result += markdown.slice(cursor);
  return result;
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
  const [replyContent, setReplyContent] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [postLikes, setPostLikes] = useState<Record<number, PostLikeState>>({});
  const [likeSaving, setLikeSaving] = useState<Record<number, boolean>>({});
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const highlightTimeoutRef = useRef<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [topicRes, postsRes, countRes, firstPostRes] = await Promise.all([
        supabase
          .from('topics')
          .select(`
            id, title, views, views_total, views_unique,
            category:categories(name, icon)
          `)
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

  const handleReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        topic_id: topicId,
        author_id: currentUser.id,
        content: replyContent.trim(),
        image_url: replyImageUrl || null,
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
      setReplyContent('');
      setReplyImageUrl('');

      if (nextPage === currentPage) {
        setPosts((prev) => [...prev, insertedPost]);
        setTotalPosts(nextTotalPosts);
        setPostLikes((prev) => ({
          ...prev,
          [insertedPost.id]: { count: 0, likedByMe: false },
        }));
        window.location.hash = `post-${insertedPost.id}`;
        setSubmitting(false);
        return;
      }

      router.push(`/forum/topic/${topicId}${nextPage > 1 ? `?page=${nextPage}` : ''}#post-${insertedPost.id}`);
      return;
    }
    setSubmitting(false);
  };

  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditImageUrl(post.image_url || '');
  };

  const cancelEditing = () => {
    setEditingPostId(null);
    setEditContent('');
    setEditImageUrl('');
  };

  const handleEditSave = async (postId: number) => {
    if (!editContent.trim() || !currentUser) return;
    setEditSaving(true);

    const { data, error } = await supabase
      .from('posts')
      .update({
        content: editContent.trim(),
        image_url: editImageUrl || null,
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

  const handleToggleLike = async (postId: number) => {
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

  const hasBeenEdited = (post: Post) => {
    if (!post.updated_at) return false;
    const updatedAt = new Date(post.updated_at).getTime();
    const createdAt = new Date(post.created_at).getTime();
    if (Number.isNaN(updatedAt) || Number.isNaN(createdAt)) return false;
    return updatedAt - createdAt > 1000;
  };


  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  const buildPageHref = (page: number) => {
    if (page <= 1) return `/forum/topic/${topicId}`;
    return `/forum/topic/${topicId}?page=${page}`;
  };

  const visiblePages = Array.from(
    new Set([
      1,
      totalPages,
      Math.max(1, currentPage - 1),
      currentPage,
      Math.min(totalPages, currentPage + 1),
    ])
  ).sort((a, b) => a - b);

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
      {/* Topic + Thread */}
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{topic.category?.icon}</span>
            <div>
              <h1 className="text-3xl font-bold mb-2">{topic.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="text-yellow-800 font-medium">{topic.category?.name}</span>
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
        {posts.map((post) => {
          const isOriginalPost = post.id === firstPostId;

          return (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={`py-6 border-b border-gray-200 last:border-b-0 scroll-mt-24 transition-colors ${
                highlightedPostId === post.id ? 'bg-yellow-50' : ''
              }`}
            >
              <div className="flex gap-4">
                {/* Author Info Sidebar */}
                <Link href={`/profile/${post.author?.id}`} className="w-32 flex-shrink-0 text-center border-r-2 border-gray-200 pr-4 hover:opacity-80">
                  {post.author?.profile_image_url ? (
                    <img src={profileThumb(post.author.profile_image_url)} alt={post.author.username} className="w-10 h-10 rounded-none object-cover mx-auto mb-2" />
                  ) : (
                    <div className="w-10 h-10 square-full bg-gray-200 text-gray-500 inline-flex items-center justify-center mb-2">
                      <User size={30} />
                    </div>
                  )}
                  <p className="font-bold text-sm mb-1" style={{ fontFamily: 'monospace' }}>{post.author?.username}</p>
                  <p className="text-xs text-gray-400">
                    {formatPostDateTime(post.created_at)}
                  </p>
                </Link>

                {/* Post Content */}
                {post.deleted_at ? (
                  <div className="flex-1 flex items-center">
                    <p className="text-gray-400 italic py-4">Tämä viesti on poistettu.</p>
                  </div>
                ) : editingPostId === post.id ? (
                  <div className="flex-1">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-lg p-3 mb-3 min-h-[120px] focus:border-yellow-400 focus:outline-none"
                    />
                    {editImageUrl && (
                      <div className="relative inline-block mb-3">
                        <img src={postThumb(editImageUrl)} alt="Liite" className="max-h-40 rounded-lg" />
                        <button
                          type="button"
                          onClick={() => setEditImageUrl('')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CldUploadWidget
                        uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                        options={{ maxFiles: 1, resourceType: 'image', folder: 'freakon/posts' }}
                        onSuccess={(result: unknown) => {
                          const secureUrl = extractSecureUrl(result);
                          if (secureUrl) {
                            setEditImageUrl(secureUrl);
                          }
                        }}
                      >
                        {({ open }) => (
                          <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
                            <ImagePlus size={16} />
                            {editImageUrl ? 'Vaihda kuva' : 'Lisää kuva'}
                          </Button>
                        )}
                      </CldUploadWidget>
                      <Button variant="outline" onClick={cancelEditing}>
                        Peruuta
                      </Button>
                      <Button
                        variant="success"
                        className="flex items-center gap-2"
                        onClick={() => handleEditSave(post.id)}
                        disabled={editSaving || !editContent.trim()}
                      >
                        <Save size={16} />
                        {editSaving ? 'Tallennetaan...' : 'Tallenna'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="prose max-w-none mb-4">
                      {(() => {
                        const youtubeEmbeds = extractYouTubeEmbedUrls(post.content);

                        return (
                          <>
                      <ReactMarkdown
                        rehypePlugins={[[rehypeSanitize, {
                          ...defaultSchema,
                          attributes: {
                            ...defaultSchema.attributes,
                            a: [...(defaultSchema.attributes?.a || []), ['target', '_blank'], ['rel', 'noopener noreferrer']],
                          },
                        }]]}
                        components={{
                          a: ({ href, children }) => {
                            let safeHref = href;
                            try {
                              const url = new URL(href || '', 'https://placeholder.invalid');
                              if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
                                safeHref = undefined;
                              }
                            } catch {
                              safeHref = undefined;
                            }

                            const firstChild = Array.isArray(children) ? children[0] : children;
                            const label = typeof firstChild === 'string' ? firstChild : '';
                            const shouldShorten = label && /^https?:\/\//i.test(label);
                            const visibleText = shouldShorten ? shortenUrlDisplay(label) : children;

                            if (!safeHref) {
                              return <span>{visibleText}</span>;
                            }

                            return (
                              <a href={safeHref} target="_blank" rel="noopener noreferrer">
                                {visibleText}
                              </a>
                            );
                          },
                        }}
                      >
                        {autoLinkPlainUrls(post.content)}
                      </ReactMarkdown>
                            {youtubeEmbeds.length > 0 && (
                              <div className="mt-4 space-y-3 not-prose">
                                {youtubeEmbeds.map((embedUrl) => (
                                  <div key={`${post.id}-${embedUrl}`} className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-gray-200 bg-black" style={{ paddingTop: '56.25%' }}>
                                    <iframe
                                      src={embedUrl}
                                      title="YouTube video"
                                      className="absolute inset-0 h-full w-full"
                                      loading="lazy"
                                      referrerPolicy="strict-origin-when-cross-origin"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {post.image_url && (
                        <img src={postImage(post.image_url)} alt="Liite" className="mt-3 max-w-full max-h-96 rounded-lg" />
                      )}
                    </div>

                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {post.author?.signature && post.author?.show_signature && (
                          <p className="text-xs text-gray-400 italic whitespace-pre-wrap">{post.author.signature}</p>
                        )}

                        {hasBeenEdited(post) && (
                          <p className={`text-xs text-gray-400 italic ${post.author?.signature && post.author?.show_signature ? 'mt-1' : ''}`}>
                            Muokattu viimeksi {formatPostDateTime(post.updated_at as string)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          className={`inline-flex h-10 min-w-10 px-2 items-center justify-center rounded text-sm transition ${
                            copiedPostId === post.id
                              ? 'text-green-700 bg-green-100 hover:bg-green-100'
                              : 'text-gray-500 hover:text-blue-700 hover:bg-gray-100'
                          }`}
                          onClick={() => handleCopyPostLink(post.id)}
                          title="Kopioi viestilinkki"
                        >
                          {copiedPostId === post.id ? <Check size={16} /> : <Link2 size={16} />}
                        </button>
                        <button
                          className={`inline-flex h-10 min-w-10 px-2 items-center justify-center gap-1 rounded text-sm transition ${
                            postLikes[post.id]?.likedByMe
                              ? 'text-red-600 bg-red-50 hover:bg-red-100'
                              : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
                          }`}
                          onClick={() => handleToggleLike(post.id)}
                          disabled={!!likeSaving[post.id]}
                          title={postLikes[post.id]?.likedByMe ? 'Poista tykkäys' : 'Tykkää'}
                        >
                          <Heart
                            size={16}
                            className={postLikes[post.id]?.likedByMe ? 'fill-current' : ''}
                          />
                          <span>{postLikes[post.id]?.count || 0}</span>
                        </button>
                        {currentUser && currentUser.id === post.author?.id && (
                          <>
                            <button
                              className="inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:text-yellow-600 hover:bg-gray-100 transition"
                              onClick={() => startEditing(post)}
                              title="Muokkaa"
                            >
                              <Edit2 size={16} />
                            </button>
                            {!isOriginalPost && (
                              deleteConfirmId === post.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-red-600">Poistetaanko?</span>
                                  <button
                                    className="text-red-600 hover:text-red-800 text-xs font-bold"
                                    onClick={() => handleDelete(post.id)}
                                  >
                                    Kyllä
                                  </button>
                                  <button
                                    className="text-gray-500 hover:text-gray-700 text-xs"
                                    onClick={() => setDeleteConfirmId(null)}
                                  >
                                    Ei
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 transition"
                                  onClick={() => setDeleteConfirmId(post.id)}
                                  title="Poista"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-center gap-2 text-sm">
            {currentPage > 1 ? (
              <Link href={buildPageHref(currentPage - 1)} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
                Edellinen
              </Link>
            ) : (
              <span className="px-3 py-1 rounded border border-gray-200 text-gray-400">Edellinen</span>
            )}

            {visiblePages.map((page) =>
              page === currentPage ? (
                <span key={page} className="px-3 py-1 rounded bg-yellow-100 text-yellow-900 font-semibold border border-yellow-200">
                  {page}
                </span>
              ) : (
                <Link key={page} href={buildPageHref(page)} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
                  {page}
                </Link>
              )
            )}

            {currentPage < totalPages ? (
              <Link href={buildPageHref(currentPage + 1)} className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50">
                Seuraava
              </Link>
            ) : (
              <span className="px-3 py-1 rounded border border-gray-200 text-gray-400">Seuraava</span>
            )}
          </div>
        )}
      </Card>

      {/* Reply Box */}
      {currentUser ? (
        <Card className="mt-6">
          <h3 className="text-xl font-bold mb-4">Vastaa aiheeseen</h3>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg p-3 mb-4 min-h-[150px] focus:border-yellow-400 focus:outline-none"
            placeholder="Kirjoita vastauksesi..."
          />
          <p className="mb-4 -mt-2 text-xs text-gray-500">
            <a
              href="https://www.markdownguide.org/cheat-sheet/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-700 hover:underline"
            >
              Muotoile viesti Markdownilla
            </a>
          </p>
          {replyImageUrl && (
            <div className="relative inline-block mb-4">
              <img src={postThumb(replyImageUrl)} alt="Liite" className="max-h-40 rounded-lg" />
              <button
                type="button"
                onClick={() => setReplyImageUrl('')}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CldUploadWidget
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
              options={{
                maxFiles: 1,
                resourceType: 'image',
                folder: 'freakon/posts',
              }}
              onSuccess={(result: unknown) => {
                const secureUrl = extractSecureUrl(result);
                if (secureUrl) {
                  setReplyImageUrl(secureUrl);
                }
              }}
            >
              {({ open }) => (
                <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
                  <ImagePlus size={16} />
                  Lisää kuva
                </Button>
              )}
            </CldUploadWidget>
            <Button
              variant="primary"
              className="flex items-center gap-2"
              onClick={handleReply}
              disabled={submitting || !replyContent.trim()}
            >
              <MessageSquare size={16} />
              {submitting ? 'Lähetetään...' : 'Lähetä vastaus'}
            </Button>
          </div>
        </Card>
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
