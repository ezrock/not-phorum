'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { reportError } from '@/lib/reportError';

export interface RandomQuote {
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

interface UseForumQuoteOptions {
  supabase: ReturnType<typeof createClient>;
  currentUser: { id: string } | null;
  refreshKey?: number;
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

export function useForumQuote({ supabase, currentUser, refreshKey = 0 }: UseForumQuoteOptions) {
  const [quote, setQuote] = useState<RandomQuote | null>(null);
  const [quoteLikeSaving, setQuoteLikeSaving] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRandomQuote = async () => {
      try {
        setQuoteError(null);
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
          const fallbackCountRes = await supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .is('deleted_at', null)
            .gte('content', '');
          eligibleCount = fallbackCountRes.count || 0;
          useHourLimitedSet = false;
        }

        if (eligibleCount === 0) {
          setQuote(null);
          return;
        }

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
            supabase.from('quote_likes').select('profile_id', { count: 'exact', head: true }).eq('post_id', post.id),
            currentUser
              ? supabase
                  .from('quote_likes')
                  .select('post_id')
                  .eq('post_id', post.id)
                  .eq('profile_id', currentUser.id)
                  .limit(1)
              : Promise.resolve({ data: [], error: null }),
          ]);

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
      } catch (error) {
        reportError({ scope: 'forum.fetchRandomQuote', error });
        setQuoteError('Päivän lainauksen lataus epäonnistui.');
      }
    };

    void fetchRandomQuote();
  }, [supabase, currentUser, refreshKey]);

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
    } else if (data) {
      setQuote((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          liked_by_me: typeof data.liked === 'boolean' ? data.liked : prev.liked_by_me,
          likes_count: typeof data.likes_count === 'number' ? data.likes_count : prev.likes_count,
        };
      });
    }

    setQuoteLikeSaving(false);
  };

  return { quote, quoteLikeSaving, quoteError, handleToggleQuoteLike };
}
