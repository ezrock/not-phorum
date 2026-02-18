'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Heart, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatFinnishDateTime, formatFinnishRelative } from '@/lib/formatDate';
import { POSTS_PER_PAGE, THREADS_PER_PAGE } from '@/lib/pagination';
import { AddTags, type TagOption } from '@/components/forum/AddTags';

interface Topic {
  id: number;
  title: string;
  views: number;
  views_unique: number;
  created_at: string;
  category_name: string;
  category_icon: string;
  author_username: string;
  replies_count: number;
  last_post_id: number | null;
  last_post_created_at: string | null;
  has_new: boolean;
}

interface RawTopicRow extends Omit<Topic, 'replies_count'> {
  replies_count?: number | null;
  messages_count?: number | null;
}

interface TopicsApiResponse {
  topics?: RawTopicRow[];
  total_count?: number;
}

interface RandomQuote {
  post_id: number;
  content: string;
  created_at: string;
  topic_id: number;
  author_username: string | null;
  likes_count: number;
  liked_by_me: boolean;
}

interface RawRandomQuoteRow {
  id: number;
  content: string;
  created_at: string;
  topic_id: number;
  author: { username: string } | { username: string }[] | null;
}

function extractAuthorUsername(author: RawRandomQuoteRow['author']): string | null {
  if (!author) return null;
  if (Array.isArray(author)) {
    return author[0]?.username || null;
  }
  return author.username || null;
}

function getUtcHourStartIso(now: Date): string {
  const hourStart = new Date(now);
  hourStart.setUTCMinutes(0, 0, 0);
  return hourStart.toISOString();
}

function getHourSeed(now: Date): number {
  return Math.floor(now.getTime() / 3_600_000);
}

function deterministicOffset(seed: number, modulo: number): number {
  if (modulo <= 0) return 0;
  const mixed = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return mixed % modulo;
}

function ForumContent() {
  const { supabase, currentUser, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [threadCount, setThreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const [quote, setQuote] = useState<RandomQuote | null>(null);
  const [quoteLikeSaving, setQuoteLikeSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const realtimeUpdatesEnabled = (profile as { realtime_updates_enabled?: boolean } | null)?.realtime_updates_enabled === true;

  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedTagsParam = searchParams.get('tags') || '';
  const requestedTagMatch = searchParams.get('match') === 'all' ? 'all' : 'any';
  const requestedTagIds = useMemo(
    () =>
      Array.from(
        new Set(
          requestedTagsParam
            .split(',')
            .map((part) => Number.parseInt(part.trim(), 10))
            .filter((id) => Number.isFinite(id) && id > 0)
        )
      ),
    [requestedTagsParam]
  );

  const formatRepliesLabel = (count: number) => {
    return `${count} ${count === 1 ? 'vastaus' : 'vastausta'}`;
  };

  const getLastPostPage = (topic: Topic) => {
    const totalPosts = Math.max(topic.replies_count + 1, topic.last_post_id ? 1 : 0);
    return Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  };

  const buildPageHref = (page: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      next.delete('page');
    } else {
      next.set('page', String(page));
    }
    const query = next.toString();
    return query ? `/forum?${query}` : '/forum';
  };

  const pushFilterUrl = (nextTagIds: number[], nextMatch: 'any' | 'all') => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('page');
    if (nextTagIds.length > 0) {
      next.set('tags', nextTagIds.join(','));
    } else {
      next.delete('tags');
    }
    if (nextMatch === 'all' && nextTagIds.length > 1) {
      next.set('match', 'all');
    } else {
      next.delete('match');
    }
    const query = next.toString();
    router.push(query ? `/forum?${query}` : '/forum');
  };

  useEffect(() => {
    if (requestedTagIds.length === 0) {
      Promise.resolve().then(() => setSelectedTags([]));
      return;
    }

    const controller = new AbortController();
    const fetchSelectedTags = async () => {
      try {
        const res = await fetch(`/api/tags?status=approved&featured=true&ids=${requestedTagIds.join(',')}&limit=100`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) {
          setSelectedTags([]);
          return;
        }
        const data = (await res.json()) as { tags?: TagOption[] };
        const byId = new Map((data.tags || []).map((tag) => [tag.id, tag]));
        const ordered = requestedTagIds.map((id) => byId.get(id)).filter((tag): tag is TagOption => !!tag);
        setSelectedTags(ordered);
      } catch {
        setSelectedTags([]);
      }
    };

    fetchSelectedTags();
    return () => controller.abort();
  }, [requestedTagsParam, requestedTagIds, requestedTagMatch]);

  useEffect(() => {
    const fetchTopics = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('page_size', String(THREADS_PER_PAGE));
      if (requestedTagIds.length > 0) {
        params.set('tag_ids', requestedTagIds.join(','));
        params.set('match', requestedTagMatch);
      }

      const res = await fetch(`/api/topics?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        setTopics([]);
        setThreadCount(0);
        setLoading(false);
        return;
      }
      const payload = (await res.json()) as TopicsApiResponse;
      const rows = payload.topics || [];

      const normalized = rows.map((topic) => {
        const repliesCount =
          typeof topic.replies_count === 'number'
            ? topic.replies_count
            : Math.max((topic.messages_count || 0) - 1, 0);

        return {
          ...topic,
          replies_count: repliesCount,
        } as Topic;
      });

      setTopics(normalized);
      setThreadCount(payload.total_count || 0);
      setLoading(false);
    };

    const fetchRandomQuote = async () => {
      const now = new Date();
      const utcHourStartIso = getUtcHourStartIso(now);
      const hourSeed = getHourSeed(now);

      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .lt('created_at', utcHourStartIso)
        .gte('content', '');

      let eligibleCount = count || 0;
      let useHourLimitedSet = true;

      if (eligibleCount === 0) {
        // Fallback for brand new boards where all posts may be from the current hour.
        const fallbackCountRes = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .gte('content', '');
        eligibleCount = fallbackCountRes.count || 0;
        useHourLimitedSet = false;
      }

      if (eligibleCount === 0) return;

      const quoteOffset = deterministicOffset(hourSeed, eligibleCount);
      let quoteQuery = supabase
        .from('posts')
        .select('id, content, created_at, topic_id, author:profiles!author_id(username)')
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(quoteOffset, quoteOffset);

      if (useHourLimitedSet) {
        quoteQuery = quoteQuery.lt('created_at', utcHourStartIso);
      }

      const { data } = await quoteQuery;

      if (data && data.length > 0) {
        const post = data[0] as RawRandomQuoteRow;
        const [likesCountRes, myLikeRes] = await Promise.all([
          supabase
            .from('quote_likes')
            .select('profile_id', { count: 'exact', head: true })
            .eq('post_id', post.id),
          currentUser
            ? supabase
                .from('quote_likes')
                .select('post_id')
                .eq('post_id', post.id)
                .eq('profile_id', currentUser.id)
                .limit(1)
            : Promise.resolve({ data: [], error: null }),
        ]);

        // Trim to first ~150 chars at a word boundary
        let snippet = post.content;
        if (snippet.length > 150) {
          snippet = snippet.substring(0, 150).replace(/\s+\S*$/, '') + '...';
        }
        setQuote({
          post_id: post.id,
          content: snippet,
          created_at: post.created_at,
          topic_id: post.topic_id,
          author_username: extractAuthorUsername(post.author),
          likes_count: likesCountRes.count || 0,
          liked_by_me: !!myLikeRes.data && myLikeRes.data.length > 0,
        });
      }
    };

    const fetchMessageCount = async () => {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

      setMessageCount(count || 0);
    };

    fetchTopics();
    fetchRandomQuote();
    fetchMessageCount();
  }, [supabase, currentPage, currentUser, refreshTick, requestedTagIds, requestedTagMatch]);

  useEffect(() => {
    if (!currentUser || !realtimeUpdatesEnabled) return;

    const channel = supabase
      .channel(`forum-live-${currentUser.id}-${currentPage}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'topics' }, () => {
        setRefreshTick((prev) => prev + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        setRefreshTick((prev) => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUser, currentPage, realtimeUpdatesEnabled]);

  const handleToggleQuoteLike = async () => {
    if (!quote || quoteLikeSaving) return;
    setQuoteLikeSaving(true);

    const previous = quote;
    setQuote({
      ...quote,
      liked_by_me: !quote.liked_by_me,
      likes_count: Math.max(quote.likes_count + (quote.liked_by_me ? -1 : 1), 0),
    });

    const { data, error } = await supabase.rpc('toggle_quote_like', {
      target_post_id: quote.post_id,
    });

    if (error) {
      setQuote(previous);
    } else {
      const result = data as { liked?: boolean; likes_count?: number } | null;
      if (result) {
        setQuote((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            liked_by_me: typeof result.liked === 'boolean' ? result.liked : prev.liked_by_me,
            likes_count: typeof result.likes_count === 'number' ? result.likes_count : prev.likes_count,
          };
        });
      }
    }

    setQuoteLikeSaving(false);
  };

  const totalPages = Math.max(1, Math.ceil(threadCount / THREADS_PER_PAGE));
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

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {quote && (
              <div className="min-w-0 text-gray-500 text-xs italic leading-relaxed flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleQuoteLike}
                  disabled={quoteLikeSaving}
                  className={`inline-flex h-5 items-center gap-1 rounded px-1.5 not-italic leading-none transition ${
                    quote.liked_by_me
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
                  }`}
                  title={quote.liked_by_me ? 'Poista tykkäys lainaukselta' : 'Tykkää lainauksesta'}
                >
                  <Heart size={12} className={`h-3 w-3 shrink-0 ${quote.liked_by_me ? 'fill-current' : ''}`} />
                  <span className="inline-flex items-center leading-none tabular-nums">{quote.likes_count}</span>
                </button>
                <span className="min-w-0 break-words">
                  &ldquo;{quote.content}&rdquo; &mdash; {quote.author_username || 'tuntematon'},{' '}
                  <Link href={`/forum/topic/${quote.topic_id}`} className="text-yellow-700 hover:underline not-italic">
                    {formatFinnishDateTime(quote.created_at)}
                  </Link>
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 whitespace-nowrap text-right">
            {threadCount} lankaa, {messageCount} viestiä.
          </p>
        </div>
        
        <Link href="/forum/new" className="block w-full mt-4">
          <Button
            variant="primary"
            className="w-full whitespace-normal text-center leading-tight flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Uusi aihe
          </Button>
        </Link>
        <div className="mt-4 space-y-2">
          <AddTags
            selected={selectedTags}
            onChange={(next) => {
              setSelectedTags(next);
              pushFilterUrl(next.map((tag) => tag.id), requestedTagMatch);
            }}
          />
          <div className="flex items-center gap-2">
            <label htmlFor="match-mode" className="text-xs text-gray-500">
              Osumatapa
            </label>
            <select
              id="match-mode"
              value={requestedTagMatch}
              onChange={(e) => {
                const nextMatch = e.target.value === 'all' ? 'all' : 'any';
                pushFilterUrl(selectedTags.map((tag) => tag.id), nextMatch);
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
              disabled={selectedTags.length < 2}
            >
              <option value="any">Mikä tahansa tagi</option>
              <option value="all">Kaikki valitut tagit</option>
            </select>
            {selectedTags.length > 0 && (
              <button
                type="button"
                className="text-xs text-yellow-700 hover:underline"
                onClick={() => {
                  setSelectedTags([]);
                  pushFilterUrl([], 'any');
                }}
              >
                Tyhjennä tagifiltteri
              </button>
            )}
          </div>
        </div>
      </div>

      {topics.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">
            {selectedTags.length > 0
              ? 'Ei aiheita valituilla tageilla.'
              : 'Ei vielä aiheita. Ole ensimmäinen ja aloita keskustelu!'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-200">
          {topics.map((topic) => {
            const lastPostPage = getLastPostPage(topic);
            const topicHref = `/forum/topic/${topic.id}${topic.last_post_id ? `${lastPostPage > 1 ? `?page=${lastPostPage}` : ''}#post-${topic.last_post_id}` : ''}`;

            return (
            <Link
              key={topic.id}
              href={topicHref}
              className="block hover:bg-yellow-50/40 transition"
            >
              <div className="py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 text-center">
                    <div className="text-2xl">{topic.category_icon}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text font-bold text-gray-800 truncate">
                        {topic.title}
                      </h3>
                      {topic.has_new && (
                        <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                          Uusi
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="text-yellow-800 font-medium text-sm">
                        {topic.category_name}
                      </span>
                      <span className="truncate font-mono">
                        {topic.author_username}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-gray-500 flex-shrink-0">
                  <p>{formatRepliesLabel(topic.replies_count)}</p>
                    <p className="text-sm text-gray-500">
                      {formatFinnishRelative(topic.last_post_created_at || topic.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
          })}
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
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
    </div>
  );
}

export default function ForumPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto mt-8 px-4"><Card><p className="text-center text-gray-500 py-8">Ladataan...</p></Card></div>}>
      <ForumContent />
    </Suspense>
  );
}
