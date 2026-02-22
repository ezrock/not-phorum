import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/topics/route';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

interface BuildTopicsSupabaseOptions {
  canonicalRequested?: number[];
  canonicalExcluded?: number[];
  canonicalErrorMessage?: string;
  topicListError?: string;
  topicCountError?: string;
  legacyTopicList?: unknown[];
  legacyTopicCount?: number;
}

function buildTopicsSupabase(options: BuildTopicsSupabaseOptions = {}) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'resolve_canonical_tag_ids') {
      const tagIds = (args.input_tag_ids as number[]) || [];
      if (options.canonicalErrorMessage && tagIds.includes(1)) {
        return { data: null, error: { message: options.canonicalErrorMessage } };
      }
      if (tagIds.includes(8) || tagIds.includes(9)) {
        return {
          data: options.canonicalExcluded ?? [80, 90],
          error: null,
        };
      }
      return {
        data: options.canonicalRequested ?? [2, 3],
        error: null,
      };
    }

    if (fn === 'get_topic_list_state_filtered_with_exclusions') {
      if (options.topicListError) {
        return { data: null, error: { message: options.topicListError } };
      }
      return {
        data: [
          {
            id: 1,
            title: 'Topic',
            views: 1,
            views_unique: 1,
            created_at: '2026-02-22T10:00:00.000Z',
            category_name: 'Retro',
            category_icon: '🏷️',
            author_username: 'alice',
            replies_count: 0,
            last_post_id: 1,
            last_post_created_at: '2026-02-22T10:00:00.000Z',
            jump_post_id: 1,
            unread_count: 0,
            has_new: false,
          },
        ],
        error: null,
      };
    }

    if (fn === 'get_topic_count_filtered_with_exclusions') {
      if (options.topicCountError) {
        return { data: null, error: { message: options.topicCountError } };
      }
      return { data: 11, error: null };
    }

    if (fn === 'get_topic_list_state_filtered') {
      return {
        data: options.legacyTopicList ?? [],
        error: null,
      };
    }
    if (fn === 'get_topic_count_filtered') {
      return {
        data: options.legacyTopicCount ?? 0,
        error: null,
      };
    }

    return { data: null, error: null };
  });

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                hidden_tag_ids: [8],
                hidden_tag_group_ids: [7],
                legacy_tag_icons_enabled: true,
              },
            })),
          })),
        })),
      };
    }

    if (table === 'tag_group_members') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [{ tag_id: 9 }],
          })),
        })),
      };
    }

    if (table === 'tags') {
      return {
        select: vi.fn(() => ({
          is: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ name: 'Retro', icon: '🔥', legacy_icon_path: '/legacy.gif' }],
            })),
          })),
        })),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    rpc,
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })),
    },
  };
}

describe('GET /api/topics', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('parses query params and returns filtered topics payload', async () => {
    const supabase = buildTopicsSupabase();
    createClientMock.mockResolvedValue(supabase);

    const req = new NextRequest('http://localhost/api/topics?page=2&page_size=999&tag_ids=1,2,foo,2&match=all');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.page).toBe(2);
    expect(json.page_size).toBe(100);
    expect(json.total_count).toBe(11);
    expect(json.filter).toEqual({ tag_ids: [2, 3], match: 'all' });
    expect(json.topics[0]?.category_icon).toBe('/legacy.gif');

    expect(supabase.rpc).toHaveBeenCalledWith('get_topic_list_state_filtered_with_exclusions', {
      input_page: 2,
      input_page_size: 100,
      input_tag_ids: [2, 3],
      input_match_all: true,
      input_excluded_tag_ids: [80, 90],
    });
  });

  it('returns 400 when canonical tag resolution fails', async () => {
    const supabase = buildTopicsSupabase({ canonicalErrorMessage: 'bad tags' });
    createClientMock.mockResolvedValue(supabase);

    const req = new NextRequest('http://localhost/api/topics?tag_ids=1');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('bad tags');
  });

  it('falls back to legacy RPCs when exclusion-aware RPCs fail', async () => {
    const supabase = buildTopicsSupabase({
      topicListError: 'missing function',
      legacyTopicList: [
        {
          id: 2,
          title: 'Legacy topic',
          views: 5,
          views_unique: 4,
          created_at: '2026-02-22T10:00:00.000Z',
          category_name: 'Retro',
          category_icon: '🏷️',
          author_username: 'bob',
          replies_count: 1,
          last_post_id: 2,
          last_post_created_at: '2026-02-22T10:00:00.000Z',
          jump_post_id: 2,
          unread_count: 0,
          has_new: false,
        },
      ],
      legacyTopicCount: 1,
    });
    createClientMock.mockResolvedValue(supabase);

    const req = new NextRequest('http://localhost/api/topics');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.total_count).toBe(1);
    expect(json.topics).toHaveLength(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_topic_list_state_filtered',
      expect.objectContaining({
        input_page: 1,
      })
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'get_topic_count_filtered',
      expect.objectContaining({
        input_match_all: false,
      })
    );
  });
});
