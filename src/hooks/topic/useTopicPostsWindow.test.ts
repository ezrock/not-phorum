import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTopicPostsWindow } from '@/hooks/topic/useTopicPostsWindow';

interface MockPostRow {
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
  };
}

function makePostRow(id: number): MockPostRow {
  return {
    id,
    content: `Post ${id}`,
    created_at: `2026-02-${String(Math.min(id, 28)).padStart(2, '0')}T10:00:00.000Z`,
    updated_at: null,
    deleted_at: null,
    image_url: null,
    author: {
      id: 'author-1',
      username: 'tester',
      profile_image_url: null,
      created_at: '2020-01-01T00:00:00.000Z',
      signature: null,
      show_signature: true,
    },
  };
}

function buildMockSupabase(totalPosts = 40, options?: { aroundShouldFail?: boolean }) {
  const posts = Array.from({ length: totalPosts }, (_, index) => makePostRow(index + 1));
  const aroundRpcSpy = vi.fn();
  const recordViewRpcSpy = vi.fn();

  const supabase = {
    from: vi.fn((table: string) => ({
      select: vi.fn((columns: string, options?: { count?: string; head?: boolean }) => {
        if (table === 'topics') {
          return {
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 99,
                  title: 'Test topic',
                  author_id: 'author-1',
                  views: 1,
                  views_total: 1,
                  views_unique: 1,
                },
                error: null,
              })),
            })),
          };
        }

        if (table === 'topic_tags') {
          return {
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({
                data: [
                  {
                    tag: {
                      id: 5,
                      name: 'Retro',
                      slug: 'retro',
                      icon: '🔥',
                      legacy_icon_path: '/legacy.gif',
                      status: 'approved',
                      redirect_to_tag_id: null,
                    },
                  },
                ],
                error: null,
              })),
            })),
          };
        }

        if (table === 'posts' && options?.count === 'exact' && options?.head === true) {
          return {
            eq: vi.fn(async () => ({ count: totalPosts, error: null })),
          };
        }

        if (table === 'posts' && columns === 'id') {
          return {
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async (limit: number) => ({
                  data: posts.slice(0, limit).map((row) => ({ id: row.id })),
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'posts') {
          return {
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(async (start: number, end: number) => ({
                  data: posts.slice(start, end + 1),
                  error: null,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected from/select chain for table=${table}`);
      }),
    })),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'record_topic_view') {
        recordViewRpcSpy(args);
        return {
          data: {
            views_unique: 12,
            views_total: 34,
          },
          error: null,
        };
      }

      if (fn === 'get_topic_posts_around') {
        aroundRpcSpy(args);
        if (options?.aroundShouldFail) {
          return { data: null, error: { message: 'forced test failure' } };
        }
        const target = Number(args.input_post_id);
        const startId = Math.max(1, target - 5);
        const endId = Math.min(totalPosts, target + 5);
        const rows = posts.slice(startId - 1, endId).map((row, idx) => ({
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          updated_at: row.updated_at,
          deleted_at: row.deleted_at,
          image_url: row.image_url,
          author_id: row.author.id,
          author_username: row.author.username,
          author_profile_image_url: row.author.profile_image_url,
          author_created_at: row.author.created_at,
          author_signature: row.author.signature,
          author_show_signature: row.author.show_signature,
          post_row_number: startId + idx,
          total_rows: totalPosts,
        }));
        return { data: rows, error: null };
      }

      return { data: null, error: null };
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  } as unknown as Parameters<typeof useTopicPostsWindow>[0]['supabase'];

  return { supabase, aroundRpcSpy, recordViewRpcSpy };
}

describe('useTopicPostsWindow', () => {
  beforeEach(() => {
    window.location.hash = '';
    vi.restoreAllMocks();
  });

  it('hydrates topic/posts and applies topic view counters + primary tag icon mode', async () => {
    const { supabase, recordViewRpcSpy } = buildMockSupabase(40);

    const { result } = renderHook(() =>
      useTopicPostsWindow({
        topicId: 99,
        currentUser: null,
        supabase,
        profile: {
          realtime_updates_enabled: false,
          legacy_tag_icons_enabled: false,
        },
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.posts).toHaveLength(25);
    expect(result.current.totalPosts).toBe(40);
    expect(result.current.firstPostId).toBe(1);
    expect(result.current.topicPrimaryTag?.icon).toBe('🔥');
    expect(recordViewRpcSpy).toHaveBeenCalledWith({ target_topic_id: 99 });
  });

  it('loads more posts with handleShowMore and extends the visible window', async () => {
    const { supabase } = buildMockSupabase(30);

    const { result } = renderHook(() =>
      useTopicPostsWindow({
        topicId: 99,
        currentUser: null,
        supabase,
        profile: null,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(25);
    expect(result.current.canShowMore).toBe(true);

    await act(async () => {
      await result.current.handleShowMore();
    });

    await waitFor(() => expect(result.current.posts).toHaveLength(30));
    expect(result.current.canShowMore).toBe(false);
  });

  it('loads around a target post and then can fetch older posts above the window', async () => {
    const { supabase } = buildMockSupabase(40);

    const { result } = renderHook(() =>
      useTopicPostsWindow({
        topicId: 99,
        currentUser: null,
        supabase,
        profile: null,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const ok = await result.current.loadAroundPost(30);
      expect(ok).toBe(true);
    });

    expect(result.current.canLoadOlder).toBe(true);
    const countAfterAround = result.current.posts.length;

    await act(async () => {
      await result.current.loadOlderPosts();
    });

    expect(result.current.posts.length).toBeGreaterThan(countAfterAround);
    expect(result.current.posts[0]?.id).toBe(1);
  });

});
