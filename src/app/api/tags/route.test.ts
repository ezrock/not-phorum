import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tags/route';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

interface BuildTagsSupabaseOptions {
  legacyIconsEnabled?: boolean;
  rpcError?: string;
}

function buildTagsSupabase(options: BuildTagsSupabaseOptions = {}) {
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== 'get_tag_picker_options') return { data: null, error: null };
    if (options.rpcError) return { data: null, error: { message: options.rpcError } };
    return {
      data: [
        {
          id: 10,
          name: 'Retro',
          slug: 'retro',
          icon: '🏷️',
        },
      ],
      error: null,
    };
  });

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                legacy_tag_icons_enabled: options.legacyIconsEnabled ?? true,
              },
            })),
          })),
        })),
      };
    }
    if (table === 'tags') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [{ id: 10, icon: '🔥', legacy_icon_path: '/legacy.gif' }],
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

describe('GET /api/tags', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('returns empty set when status is not approved', async () => {
    const supabase = buildTagsSupabase();
    createClientMock.mockResolvedValue(supabase);

    const req = new NextRequest('http://localhost/api/tags?status=pending');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ tags: [] });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('parses filters and returns icon-resolved tags', async () => {
    const supabase = buildTagsSupabase({ legacyIconsEnabled: false });
    createClientMock.mockResolvedValue(supabase);

    const req = new NextRequest(
      'http://localhost/api/tags?status=approved&query=ret&limit=999&featured=1&ids=1,2,foo,2'
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tags).toHaveLength(1);
    expect(json.tags[0]?.icon).toBe('🔥');

    expect(supabase.rpc).toHaveBeenCalledWith('get_tag_picker_options', {
      input_query: 'ret',
      input_limit: 100,
      input_featured: true,
      input_ids: [1, 2],
    });
  });

  it('returns 400 when tag options RPC fails', async () => {
    const supabase = buildTagsSupabase({ rpcError: 'rpc failed' });
    createClientMock.mockResolvedValue(supabase);

    const req = new NextRequest('http://localhost/api/tags?status=approved');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('rpc failed');
  });
});
