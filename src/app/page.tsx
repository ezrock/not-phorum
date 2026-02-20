'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { formatFinnishDateTime } from '@/lib/formatDate';
import { eventOccursOnDate } from '@/lib/siteEvents';
import { useForumTopics } from '@/hooks/useForumTopics';
import { useForumQuote } from '@/hooks/useForumQuote';
import { ForumThreadList } from '@/components/forum/ForumThreadList';
import { reportError } from '@/lib/reportError';

interface RawSiteEventRow {
  id: number;
  name: string;
  event_date: string;
  repeats_yearly: boolean;
  date_range_enabled: boolean;
  range_start_date: string | null;
  range_end_date: string | null;
}

function formatEventDate(dateValue: string): string {
  if (!dateValue) return '-';
  const date = new Date(`${dateValue}T00:00:00`);
  return new Intl.DateTimeFormat('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function ForumContent() {
  const { supabase, currentUser, profile } = useAuth();
  const realtimeUpdatesEnabled =
    (profile as { realtime_updates_enabled?: boolean } | null)?.realtime_updates_enabled === true;

  const {
    topics,
    threadCount,
    messageCount,
    loading,
    loadingMore,
    requestedTagIds,
    unreadOnly,
    visibleCount,
    handleShowMore,
    pushUnreadOnlyUrl,
    refreshTick,
    dataError,
    retryDataFetch,
  } = useForumTopics({
    supabase,
    currentUser,
    realtimeUpdatesEnabled,
  });

  const { quote, quoteLikeSaving, quoteError, handleToggleQuoteLike } = useForumQuote({
    supabase,
    currentUser,
    refreshKey: refreshTick,
  });

  const [todaySingleDayEvent, setTodaySingleDayEvent] = useState<RawSiteEventRow | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTodaySingleDayEvent = async () => {
      try {
        setEventError(null);
        const { data, error } = await supabase
          .from('site_events')
          .select('id, name, event_date, repeats_yearly, date_range_enabled, range_start_date, range_end_date');

        if (error || !data) {
          if (error) {
            reportError({ scope: 'forum.fetchTodaySingleDayEvent', error });
          }
          setTodaySingleDayEvent(null);
          setEventError('Tapahtumatiedon lataus epäonnistui.');
          return;
        }

        const today = new Date();
        const matches = (data as RawSiteEventRow[])
          .filter((event) => event.date_range_enabled !== true)
          .filter((event) => eventOccursOnDate(event, today))
          .sort((a, b) => b.id - a.id);

        setTodaySingleDayEvent(matches[0] ?? null);
      } catch (error) {
        reportError({ scope: 'forum.fetchTodaySingleDayEvent', error });
        setTodaySingleDayEvent(null);
        setEventError('Tapahtumatiedon lataus epäonnistui.');
      }
    };

    void fetchTodaySingleDayEvent();
  }, [supabase, refreshTick]);

  const unreadThreadCount = useMemo(
    () => topics.filter((topic) => topic.unread_count > 0).length,
    [topics]
  );

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
        {(dataError || quoteError || eventError) && (
          <Alert variant="error">
            <div className="flex items-center justify-between gap-3">
              <span>{dataError || quoteError || eventError}</span>
              <Button
                type="button"
                variant="outline"
                onClick={retryDataFetch}
                className="admin-compact-btn"
              >
                Yritä uudelleen
              </Button>
            </div>
          </Alert>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {todaySingleDayEvent ? (
              <div className="min-w-0 text-gray-500 text-xs italic leading-relaxed">
                🎂 Tänään on {todaySingleDayEvent.name} ({formatEventDate(todaySingleDayEvent.event_date)} -)
              </div>
            ) : quote ? (
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
                  <Link href={`/topic/${quote.topic_id}`} className="text-yellow-700 hover:underline not-italic">
                    {formatFinnishDateTime(quote.created_at)}
                  </Link>
                </span>
              </div>
            ) : null}
          </div>

          <p className="text-xs text-gray-500 whitespace-nowrap text-right">
            {threadCount} lankaa, {messageCount} viestiä
            {unreadThreadCount > 0 && (
              <>
                ,{' '}
                <button
                  type="button"
                  onClick={() => pushUnreadOnlyUrl(!unreadOnly)}
                  className="text-highlight-glimmer hover:underline"
                  title={unreadOnly ? 'Näytä kaikki langat' : 'Näytä vain lukemattomat langat'}
                >
                  {unreadThreadCount} lukematonta
                </button>
              </>
            )}
            .
          </p>
        </div>

      </div>

      <ForumThreadList
        topics={topics}
        threadCount={threadCount}
        visibleCount={visibleCount}
        loadingMore={loadingMore}
        unreadOnly={unreadOnly}
        requestedTagIds={requestedTagIds}
        onShowMore={handleShowMore}
      />
    </div>
  );
}

export default function ForumPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto mt-8 px-4">
          <Card>
            <p className="text-center text-gray-500 py-8">Ladataan...</p>
          </Card>
        </div>
      }
    >
      <ForumContent />
    </Suspense>
  );
}
