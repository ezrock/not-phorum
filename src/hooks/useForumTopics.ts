'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShowMorePaging } from '@/hooks/useShowMorePaging';
import { UI_PAGING_SETTINGS } from '@/lib/uiSettings';
import { createClient } from '@/lib/supabase/client';
import { err, ok } from '@/lib/result';
import { reportError } from '@/lib/reportError';

export interface Topic {
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
  jump_post_id: number | null;
  unread_count: number;
  has_new: boolean;
}

interface RawTopicRow {
  id: number;
  title: string;
  views: number;
  views_unique: number;
  created_at: string;
  category_name: string;
  category_icon: string;
  author_username: string;
  last_post_id: number | null;
  last_post_created_at: string | null;
  jump_post_id: number | null;
  has_new: boolean;
  replies_count?: number | null;
  messages_count?: number | null;
  unread_count?: number | null;
}

interface TopicsApiResponse {
  topics?: RawTopicRow[];
  total_count?: number;
  filter?: {
    tag_ids?: number[];
    match?: 'any' | 'all';
  };
}

interface UseForumTopicsOptions {
  supabase: ReturnType<typeof createClient>;
  currentUser: { id: string } | null;
  realtimeUpdatesEnabled: boolean;
}

export function useForumTopics({ supabase, currentUser, realtimeUpdatesEnabled }: UseForumTopicsOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [threadCount, setThreadCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [loadedPageCount, setLoadedPageCount] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const forumBatchSize = UI_PAGING_SETTINGS.forumShowMoreStep;
  const forumInitialVisible = UI_PAGING_SETTINGS.forumInitialVisibleThreads;
  const forumUnreadBoostMax = UI_PAGING_SETTINGS.forumUnreadBoostMaxThreads;

  const { visibleCount, setVisibleCount, resetVisibleCount } = useShowMorePaging({
    initialVisible: forumInitialVisible,
    step: forumBatchSize,
  });

  const requestedTagsParam = searchParams.get('tags') || '';
  const requestedTagMatch = searchParams.get('match') === 'all' ? 'all' : 'any';
  const unreadOnly = searchParams.get('unread') === '1';

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

  const pushFilterUrl = useCallback(
    (nextTagIds: number[], nextMatch: 'any' | 'all') => {
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
      router.push(query ? `/?${query}` : '/');
    },
    [router, searchParams]
  );

  const pushUnreadOnlyUrl = useCallback(
    (nextUnreadOnly: boolean) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete('page');
      if (nextUnreadOnly) {
        next.set('unread', '1');
      } else {
        next.delete('unread');
      }
      const query = next.toString();
      router.push(query ? `/?${query}` : '/');
    },
    [router, searchParams]
  );

  const normalizeTopics = useCallback((rows: RawTopicRow[]) => {
    return rows.map((topic) => {
      const repliesCount =
        typeof topic.replies_count === 'number'
          ? topic.replies_count
          : Math.max((topic.messages_count || 0) - 1, 0);

      return {
        ...topic,
        replies_count: repliesCount,
        unread_count:
          typeof topic.unread_count === 'number'
            ? Math.max(0, topic.unread_count)
            : topic.has_new
              ? 1
              : 0,
      } as Topic;
    });
  }, []);

  const fetchTopicsPage = useCallback(
    async (page: number) => {
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', String(forumBatchSize));
        if (requestedTagIds.length > 0) {
          params.set('tag_ids', requestedTagIds.join(','));
          params.set('match', requestedTagMatch);
        }

        const res = await fetch(`/api/topics?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) {
          const fetchError = new Error(`Topics API failed (${res.status})`);
          reportError({
            scope: 'forum.fetchTopicsPage',
            error: fetchError,
            meta: { page, status: res.status, requestedTagIds, requestedTagMatch },
          });
          return err(fetchError);
        }

        const payload = (await res.json()) as TopicsApiResponse;
        return ok(payload);
      } catch (error) {
        reportError({
          scope: 'forum.fetchTopicsPage',
          error,
          meta: { page, requestedTagIds, requestedTagMatch },
        });
        return err(error instanceof Error ? error : new Error('Topics page fetch failed'));
      }
    },
    [forumBatchSize, requestedTagIds, requestedTagMatch]
  );

  const loadMoreTopics = useCallback(
    async (targetVisibleCount: number) => {
      const nextTarget = Math.max(0, targetVisibleCount);
      const requiredPages = Math.max(1, Math.ceil(nextTarget / forumBatchSize));
      if (requiredPages <= loadedPageCount) {
        setVisibleCount(Math.min(nextTarget, threadCount));
        return;
      }

      setLoadingMore(true);
      const collected = [...topics];
      let totalCount = threadCount;
      let fetchedPages = loadedPageCount;

      for (let page = loadedPageCount + 1; page <= requiredPages; page += 1) {
        const payloadResult = await fetchTopicsPage(page);
        if (!payloadResult.ok) {
          setDataError('Aiheiden lataus epäonnistui. Päivitä sivu ja yritä uudelleen.');
          break;
        }
        const payload = payloadResult.data;
        const pageRows = normalizeTopics(payload.topics || []);
        if (pageRows.length === 0) break;
        collected.push(...pageRows);
        totalCount = payload.total_count || totalCount;
        fetchedPages = page;
        if (collected.length >= totalCount) break;
      }

      setTopics(collected);
      setThreadCount(totalCount);
      setLoadedPageCount(fetchedPages);
      setVisibleCount(Math.min(nextTarget, totalCount, collected.length));
      setLoadingMore(false);
    },
    [fetchTopicsPage, forumBatchSize, loadedPageCount, normalizeTopics, setVisibleCount, threadCount, topics]
  );

  const handleShowMore = useCallback(async () => {
    const nextVisibleTarget = visibleCount + forumBatchSize;
    await loadMoreTopics(nextVisibleTarget);
  }, [forumBatchSize, loadMoreTopics, visibleCount]);

  const retryDataFetch = useCallback(() => {
    setRefreshTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const fetchTopics = async () => {
      setLoading(true);
      setLoadingMore(false);
      setDataError(null);
      const preloadPages = Math.max(1, Math.ceil(forumUnreadBoostMax / forumBatchSize));
      const collected: Topic[] = [];
      let totalCount = 0;
      let resolvedFilterTagIds: number[] | null = null;
      let resolvedMatch: 'any' | 'all' = requestedTagMatch;

      for (let page = 1; page <= preloadPages; page += 1) {
        const payloadResult = await fetchTopicsPage(page);
        if (!payloadResult.ok) {
          setTopics([]);
          setThreadCount(0);
          setLoadedPageCount(0);
          resetVisibleCount(forumInitialVisible);
          setDataError('Aiheiden lataus epäonnistui. Päivitä sivu ja yritä uudelleen.');
          return err(payloadResult.error);
        }
        const payload = payloadResult.data;

        const rows = payload.topics || [];
        const normalizedRows = normalizeTopics(rows);
        collected.push(...normalizedRows);
        totalCount = payload.total_count || totalCount;
        resolvedFilterTagIds = Array.isArray(payload.filter?.tag_ids)
          ? payload.filter?.tag_ids.filter((id) => Number.isFinite(id) && id > 0)
          : [];
        resolvedMatch = payload.filter?.match === 'all' ? 'all' : 'any';

        if (rows.length < forumBatchSize || collected.length >= totalCount || page >= preloadPages) {
          setLoadedPageCount(page);
          break;
        }
      }

      if (
        resolvedFilterTagIds
        &&
        (requestedTagIds.join(',') !== resolvedFilterTagIds.join(',') || requestedTagMatch !== resolvedMatch)
      ) {
        pushFilterUrl(resolvedFilterTagIds, resolvedMatch);
      }

      const unreadCount = collected.filter((topic) => topic.has_new).length;
      const initialVisible =
        unreadCount > forumInitialVisible
          ? Math.min(Math.max(unreadCount, forumInitialVisible), forumUnreadBoostMax)
          : forumInitialVisible;

      setTopics(collected);
      setThreadCount(totalCount);
      resetVisibleCount(Math.min(initialVisible, Math.max(totalCount, 0)));
      return ok(undefined);
    };

    const fetchMessageCount = async () => {
      try {
        const { count, error } = await supabase
          .from('posts')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null);

        if (error) {
          reportError({ scope: 'forum.fetchMessageCount', error });
          return err(error);
        }

        setMessageCount(count || 0);
        return ok(undefined);
      } catch (error) {
        reportError({ scope: 'forum.fetchMessageCount', error });
        return err(error instanceof Error ? error : new Error('Message count fetch failed'));
      }
    };

    const fetchAll = async () => {
      const [topicsResult, messageCountResult] = await Promise.all([
        fetchTopics(),
        fetchMessageCount(),
      ]);

      if (!topicsResult.ok) {
        setDataError('Aiheiden lataus epäonnistui. Päivitä sivu ja yritä uudelleen.');
      } else if (!messageCountResult.ok) {
        setDataError('Viestimäärän lataus epäonnistui. Osa tiedoista voi puuttua.');
      }

      setLoading(false);
    };

    void fetchAll();
  }, [
    fetchTopicsPage,
    forumBatchSize,
    forumInitialVisible,
    forumUnreadBoostMax,
    normalizeTopics,
    pushFilterUrl,
    refreshTick,
    requestedTagIds,
    requestedTagMatch,
    resetVisibleCount,
    supabase,
  ]);

  useEffect(() => {
    if (!currentUser || !realtimeUpdatesEnabled) return;

    const channel = supabase
      .channel(`forum-live-${currentUser.id}`)
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
  }, [supabase, currentUser, realtimeUpdatesEnabled]);

  return {
    topics,
    threadCount,
    messageCount,
    dataError,
    loading,
    loadingMore,
    requestedTagIds,
    unreadOnly,
    visibleCount,
    handleShowMore,
    pushUnreadOnlyUrl,
    refreshTick,
    retryDataFetch,
  };
}
