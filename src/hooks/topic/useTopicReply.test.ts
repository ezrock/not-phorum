import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTopicReply } from '@/hooks/topic/useTopicReply';
import type { Post } from '@/components/forum/post';

function createState<T>(initial: T) {
  let value = initial;
  const setter = vi.fn((next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
  });
  return {
    get: () => value,
    setter,
  };
}

function makeInsertedPost(id: number) {
  return {
    id,
    content: `Reply ${id}`,
    created_at: '2026-02-22T10:00:00.000Z',
    updated_at: null,
    deleted_at: null,
    image_url: null,
    author: {
      id: 'u1',
      username: 'alice',
      profile_image_url: null,
      created_at: '2020-01-01T00:00:00.000Z',
      signature: null,
      show_signature: true,
    },
  };
}

describe('useTopicReply', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('returns early for empty content', async () => {
    const fromSpy = vi.fn();
    const supabase = { from: fromSpy } as unknown as Parameters<typeof useTopicReply>[0]['supabase'];
    const posts = createState<Post[]>([]);
    const totalPosts = createState(0);
    const windowEnd = createState(0);
    const loadAroundPost = vi.fn(async () => true);
    const addNewPostLike = vi.fn();

    const { result } = renderHook(() =>
      useTopicReply({
        topicId: 10,
        currentUser: { id: 'u1' },
        supabase,
        totalPosts: 0,
        windowEndIndex: 0,
        setPosts: posts.setter,
        setTotalPosts: totalPosts.setter,
        setWindowEndIndex: windowEnd.setter,
        loadAroundPost,
        addNewPostLike,
      })
    );

    await act(async () => {
      await result.current.handleReply('   ', '');
    });

    expect(fromSpy).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
    expect(addNewPostLike).not.toHaveBeenCalled();
  });

  it('appends inserted post when latest window is loaded', async () => {
    const insertedRow = makeInsertedPost(6);
    const single = vi.fn(async () => ({ data: insertedRow, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const supabase = { from } as unknown as Parameters<typeof useTopicReply>[0]['supabase'];

    const posts = createState<Post[]>([
      {
        id: 5,
        content: 'Existing',
        created_at: '2026-02-22T09:00:00.000Z',
        updated_at: null,
        deleted_at: null,
        image_url: null,
        author: {
          id: 'u1',
          username: 'alice',
          profile_image_url: null,
          created_at: '2020-01-01T00:00:00.000Z',
          signature: null,
          show_signature: true,
        },
      },
    ]);
    const totalPosts = createState(5);
    const windowEnd = createState(5);
    const loadAroundPost = vi.fn(async () => true);
    const addNewPostLike = vi.fn();

    const { result } = renderHook(() =>
      useTopicReply({
        topicId: 10,
        currentUser: { id: 'u1' },
        supabase,
        totalPosts: 5,
        windowEndIndex: 5,
        setPosts: posts.setter,
        setTotalPosts: totalPosts.setter,
        setWindowEndIndex: windowEnd.setter,
        loadAroundPost,
        addNewPostLike,
      })
    );

    await act(async () => {
      await result.current.handleReply('  Hello world  ', '');
    });

    expect(addNewPostLike).toHaveBeenCalledWith(6);
    expect(loadAroundPost).not.toHaveBeenCalled();
    expect(totalPosts.get()).toBe(6);
    expect(windowEnd.get()).toBe(6);
    expect(posts.get().map((p) => p.id)).toEqual([5, 6]);
    expect(window.location.hash).toBe('#post-6');
  });

  it('loads around inserted post when latest window is not loaded', async () => {
    const insertedRow = makeInsertedPost(20);
    const single = vi.fn(async () => ({ data: insertedRow, error: null }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const supabase = { from } as unknown as Parameters<typeof useTopicReply>[0]['supabase'];

    const posts = createState<Post[]>([]);
    const totalPosts = createState(10);
    const windowEnd = createState(5);
    const loadAroundPost = vi.fn(async () => true);
    const addNewPostLike = vi.fn();

    const { result } = renderHook(() =>
      useTopicReply({
        topicId: 10,
        currentUser: { id: 'u1' },
        supabase,
        totalPosts: 10,
        windowEndIndex: 5,
        setPosts: posts.setter,
        setTotalPosts: totalPosts.setter,
        setWindowEndIndex: windowEnd.setter,
        loadAroundPost,
        addNewPostLike,
      })
    );

    await act(async () => {
      await result.current.handleReply('reply', 'https://example.com/img.png');
    });

    expect(loadAroundPost).toHaveBeenCalledWith(20);
    expect(posts.setter).not.toHaveBeenCalledWith(expect.any(Function));
    expect(windowEnd.setter).not.toHaveBeenCalled();
    expect(totalPosts.get()).toBe(11);
    expect(addNewPostLike).toHaveBeenCalledWith(20);
  });

  it('clears submitting on insert error without side effects', async () => {
    const single = vi.fn(async () => ({ data: null, error: { message: 'insert failed' } }));
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const from = vi.fn(() => ({ insert }));
    const supabase = { from } as unknown as Parameters<typeof useTopicReply>[0]['supabase'];

    const posts = createState<Post[]>([]);
    const totalPosts = createState(3);
    const windowEnd = createState(3);
    const loadAroundPost = vi.fn(async () => true);
    const addNewPostLike = vi.fn();

    const { result } = renderHook(() =>
      useTopicReply({
        topicId: 10,
        currentUser: { id: 'u1' },
        supabase,
        totalPosts: 3,
        windowEndIndex: 3,
        setPosts: posts.setter,
        setTotalPosts: totalPosts.setter,
        setWindowEndIndex: windowEnd.setter,
        loadAroundPost,
        addNewPostLike,
      })
    );

    await act(async () => {
      await result.current.handleReply('reply', '');
    });

    await waitFor(() => expect(result.current.submitting).toBe(false));
    expect(addNewPostLike).not.toHaveBeenCalled();
    expect(totalPosts.get()).toBe(3);
    expect(window.location.hash).not.toBe('#post-');
  });
});
