import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useForumTopics } from '@/hooks/useForumTopics';

let queryString = '';
const routerPushMock = vi.fn();
let stableSearchParams = new URLSearchParams('');
const stableRouter = { push: routerPushMock };

vi.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => stableSearchParams,
}));

function makeSupabaseMock() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(async () => ({ count: 42, error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  } as unknown as Parameters<typeof useForumTopics>[0]['supabase'];
}

function mockTopicsFetch(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    }))
  );
}

describe('useForumTopics tag filtering pipeline', () => {
  beforeEach(() => {
    queryString = '';
    stableSearchParams = new URLSearchParams(queryString);
    routerPushMock.mockReset();
    vi.restoreAllMocks();
  });

  it('parses requestedTagIds from URL and sends them to topics API', async () => {
    queryString = 'tags=1,2,foo,2,-1&match=all';
    stableSearchParams = new URLSearchParams(queryString);
    mockTopicsFetch({
      topics: [],
      total_count: 0,
      filter: { tag_ids: [1, 2], match: 'all' },
    });
    const supabase = makeSupabaseMock();

    const { result } = renderHook(() =>
      useForumTopics({
        supabase,
        currentUser: null,
        realtimeUpdatesEnabled: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const fetchMock = vi.mocked(fetch);
    const firstCallUrl = String(fetchMock.mock.calls[0]?.[0] || '');
    expect(firstCallUrl).toContain('tag_ids=1%2C2');
    expect(firstCallUrl).toContain('match=all');
    expect(result.current.requestedTagIds).toEqual([1, 2]);
  });

  it('reconciles URL when API resolved filter differs from requested tags', async () => {
    queryString = 'tags=1';
    stableSearchParams = new URLSearchParams(queryString);
    mockTopicsFetch({
      topics: [],
      total_count: 0,
      filter: { tag_ids: [3], match: 'any' },
    });
    const supabase = makeSupabaseMock();

    const { result } = renderHook(() =>
      useForumTopics({
        supabase,
        currentUser: null,
        realtimeUpdatesEnabled: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(routerPushMock).toHaveBeenCalledWith('/?tags=3');
  });

  it('normalizes API rows into replies_count and unread_count safely', async () => {
    queryString = '';
    stableSearchParams = new URLSearchParams(queryString);
    mockTopicsFetch({
      topics: [
        {
          id: 10,
          title: 'Pipeline test',
          views: 0,
          views_unique: 0,
          created_at: '2026-02-19T10:00:00.000Z',
          category_name: 'Test',
          category_icon: '🏷️',
          author_username: 'tester',
          last_post_id: 100,
          last_post_created_at: '2026-02-19T10:00:00.000Z',
          jump_post_id: 100,
          has_new: true,
          messages_count: 5,
        },
      ],
      total_count: 1,
      filter: { tag_ids: [], match: 'any' },
    });
    const supabase = makeSupabaseMock();

    const { result } = renderHook(() =>
      useForumTopics({
        supabase,
        currentUser: null,
        realtimeUpdatesEnabled: false,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.topics).toHaveLength(1);
    expect(result.current.topics[0]?.replies_count).toBe(4);
    expect(result.current.topics[0]?.unread_count).toBe(1);
  });
});
