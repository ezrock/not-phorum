'use client';

import { Suspense, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Heart, Plus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { formatFinnishDateTime, formatFinnishRelative } from '@/lib/formatDate';

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
  author: { username: string }[] | null;
}

function ForumContent() {
  const { supabase, currentUser } = useAuth();
  const searchParams = useSearchParams();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [threadCount, setThreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [quote, setQuote] = useState<RandomQuote | null>(null);
  const [quoteLikeSaving, setQuoteLikeSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const THREADS_PER_PAGE = 20;

  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const formatRepliesLabel = (count: number) => {
    return `${count} ${count === 1 ? 'vastaus' : 'vastausta'}`;
  };

  const getLastPostPage = (topic: Topic) => {
    const totalPosts = Math.max(topic.replies_count + 1, topic.last_post_id ? 1 : 0);
    return Math.max(1, Math.ceil(totalPosts / 50));
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

  useEffect(() => {
    const fetchTopics = async () => {
      const { data, error } = await supabase
        .rpc('get_topic_list_state', {
          input_page: currentPage,
          input_page_size: THREADS_PER_PAGE,
        });

      let rows: RawTopicRow[] = [];

      if (!error && data) {
        rows = data as RawTopicRow[];
      } else {
        // Backward compatibility: DB may still have the old no-args RPC definition.
        const fallback = await supabase.rpc('get_topic_list_state');
        if (!fallback.error && fallback.data) {
          const allRows = fallback.data as RawTopicRow[];
          const start = (currentPage - 1) * THREADS_PER_PAGE;
          rows = allRows.slice(start, start + THREADS_PER_PAGE);
        }
      }

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
      setLoading(false);
    };

    const fetchThreadCount = async () => {
      const { count } = await supabase
        .from('topics')
        .select('id', { count: 'exact', head: true });
      setThreadCount(count || 0);
    };

    const fetchRandomQuote = async () => {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .gte('content', '');

      if (!count || count === 0) return;

      const randomOffset = Math.floor(Math.random() * count);
      const { data } = await supabase
        .from('posts')
        .select('id, content, created_at, topic_id, author:profiles!author_id(username)')
        .is('deleted_at', null)
        .range(randomOffset, randomOffset);

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
          author_username: post.author?.[0]?.username || null,
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
    fetchThreadCount();
    fetchRandomQuote();
    fetchMessageCount();
  }, [supabase, currentPage, currentUser]);

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
      </div>

      {topics.length === 0 ? (
        <Card>
          <p className="text-center text-gray-500 py-8">
            Ei vielä aiheita. Ole ensimmäinen ja aloita keskustelu!
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
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
              <div className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 text-center">
                    <div className="text-2xl">{topic.category_icon}</div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-800 truncate">
                        {topic.title}
                      </h3>
                      {topic.has_new && (
                        <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                          Uusi
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="text-yellow-600 font-medium text-sm">
                        {topic.category_name}
                      </span>
                      <span className="truncate" style={{ fontFamily: 'monospace' }}>
                        {topic.author_username}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                  <p>{formatRepliesLabel(topic.replies_count)}</p>
                    <p className="text-sm text-gray-700">
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
