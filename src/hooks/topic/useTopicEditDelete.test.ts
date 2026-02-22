import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTopicEditDelete } from '@/hooks/topic/useTopicEditDelete';
import type { Post } from '@/components/forum/post';
import type { Topic, TopicPrimaryTag } from '@/components/forum/types';

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

function makePost(id: number): Post {
  return {
    id,
    content: `Post ${id}`,
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

describe('useTopicEditDelete', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('startEdit on first post seeds topic drafts and clears topic error', () => {
    const posts = createState<Post[]>([makePost(1)]);
    const topic = createState<Topic | null>({
      id: 99,
      title: 'Original title',
      author_id: 'u1',
      views: 1,
      views_total: 1,
      views_unique: 1,
    });
    const topicTag = createState<TopicPrimaryTag | null>({
      id: 5,
      name: 'Retro',
      slug: 'retro',
      icon: '🔥',
    });
    const refreshTick = createState(0);

    const supabase = {
      rpc: vi.fn(),
      from: vi.fn(),
    } as unknown as Parameters<typeof useTopicEditDelete>[0]['supabase'];

    const { result } = renderHook(() =>
      useTopicEditDelete({
        topicId: 99,
        currentUser: { id: 'u1' },
        supabase,
        topic: topic.get(),
        topicPrimaryTag: topicTag.get(),
        firstPostId: 1,
        canEditTopicMeta: true,
        setTopic: topic.setter,
        setTopicPrimaryTag: topicTag.setter,
        setPosts: posts.setter,
        setRefreshTick: refreshTick.setter,
      })
    );

    act(() => {
      result.current.startEdit(makePost(1));
    });

    expect(result.current.editingPostId).toBe(1);
    expect(result.current.topicTitleDraft).toBe('Original title');
    expect(result.current.topicTagDraft).toHaveLength(1);
    expect(result.current.topicTagDraft[0]?.id).toBe(5);
    expect(result.current.topicEditError).toBe('');
  });

  it('validates first-post title length before RPC', async () => {
    const posts = createState<Post[]>([makePost(1)]);
    const topic = createState<Topic | null>({
      id: 99,
      title: 'Original title',
      author_id: 'u1',
      views: 1,
      views_total: 1,
      views_unique: 1,
    });
    const topicTag = createState<TopicPrimaryTag | null>(null);
    const refreshTick = createState(0);
    const rpc = vi.fn();

    const supabase = {
      rpc,
      from: vi.fn(),
    } as unknown as Parameters<typeof useTopicEditDelete>[0]['supabase'];

    const { result } = renderHook(() =>
      useTopicEditDelete({
        topicId: 99,
        currentUser: { id: 'u1' },
        supabase,
        topic: topic.get(),
        topicPrimaryTag: topicTag.get(),
        firstPostId: 1,
        canEditTopicMeta: true,
        setTopic: topic.setter,
        setTopicPrimaryTag: topicTag.setter,
        setPosts: posts.setter,
        setRefreshTick: refreshTick.setter,
      })
    );

    act(() => {
      result.current.startEdit(makePost(1));
      result.current.setTopicTitleDraft('ab');
    });

    await act(async () => {
      await result.current.handleEditSave(1, 'updated content', '');
    });

    expect(result.current.topicEditError).toBe('Otsikon pitää olla vähintään 3 merkkiä');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('saves first-post topic meta via RPC and updates topic, tag, and post state', async () => {
    const posts = createState<Post[]>([makePost(1), makePost(2)]);
    const topic = createState<Topic | null>({
      id: 99,
      title: 'Original title',
      author_id: 'u1',
      views: 1,
      views_total: 1,
      views_unique: 1,
    });
    const topicTag = createState<TopicPrimaryTag | null>({
      id: 5,
      name: 'Retro',
      slug: 'retro',
      icon: '🔥',
    });
    const refreshTick = createState(0);

    const rpc = vi.fn(async () => ({
      data: [
        {
          topic_id: 99,
          topic_title: 'Updated title',
          post_id: 1,
          post_content: 'Updated first post',
          post_image_url: 'https://example.com/new.png',
          tag_id: 9,
          tag_name: 'PC',
          tag_slug: 'pc',
          tag_icon: '🖥️',
        },
      ],
      error: null,
    }));

    const supabase = {
      rpc,
      from: vi.fn(),
    } as unknown as Parameters<typeof useTopicEditDelete>[0]['supabase'];

    const { result } = renderHook(() =>
      useTopicEditDelete({
        topicId: 99,
        currentUser: { id: 'u1' },
        supabase,
        topic: topic.get(),
        topicPrimaryTag: topicTag.get(),
        firstPostId: 1,
        canEditTopicMeta: true,
        setTopic: topic.setter,
        setTopicPrimaryTag: topicTag.setter,
        setPosts: posts.setter,
        setRefreshTick: refreshTick.setter,
      })
    );

    act(() => {
      result.current.startEdit(makePost(1));
      result.current.setTopicTitleDraft('Updated title');
      result.current.setTopicTagDraft([{ id: 9, name: 'PC', slug: 'pc', icon: '🖥️' }]);
    });

    await act(async () => {
      await result.current.handleEditSave(1, 'Updated first post', 'https://example.com/new.png');
    });

    expect(rpc).toHaveBeenCalledWith(
      'edit_topic_first_post_details',
      expect.objectContaining({
        input_topic_id: 99,
        input_title: 'Updated title',
        input_content: 'Updated first post',
        input_tag_id: 9,
      })
    );
    expect(topic.get()?.title).toBe('Updated title');
    expect(topicTag.get()).toEqual({
      id: 9,
      name: 'PC',
      slug: 'pc',
      icon: '🖥️',
    });
    expect(posts.get()[0]?.content).toBe('Updated first post');
    expect(posts.get()[0]?.image_url).toBe('https://example.com/new.png');
    expect(result.current.editingPostId).toBeNull();
    expect(refreshTick.get()).toBe(0);
  });

  it('saves and deletes non-first posts via posts table updates', async () => {
    const posts = createState<Post[]>([makePost(1), makePost(2)]);
    const topic = createState<Topic | null>({
      id: 99,
      title: 'Topic',
      author_id: 'u1',
      views: 1,
      views_total: 1,
      views_unique: 1,
    });
    const topicTag = createState<TopicPrimaryTag | null>(null);
    const refreshTick = createState(0);

    const singleEdit = vi.fn(async () => ({
      data: {
        ...makePost(2),
        content: 'Edited second post',
        updated_at: '2026-02-22T11:00:00.000Z',
      },
      error: null,
    }));
    const singleDelete = vi.fn(async () => ({
      data: {
        ...makePost(2),
        deleted_at: '2026-02-22T12:00:00.000Z',
      },
      error: null,
    }));
    const selectEdit = vi.fn(() => ({ single: singleEdit }));
    const selectDelete = vi.fn(() => ({ single: singleDelete }));
    const eqAuthorEdit = vi.fn(() => ({ select: selectEdit }));
    const eqIdEdit = vi.fn(() => ({ eq: eqAuthorEdit }));
    const eqAuthorDelete = vi.fn(() => ({ select: selectDelete }));
    const eqIdDelete = vi.fn(() => ({ eq: eqAuthorDelete }));
    const update = vi
      .fn()
      .mockImplementationOnce(() => ({ eq: eqIdEdit }))
      .mockImplementationOnce(() => ({ eq: eqIdDelete }));
    const from = vi.fn(() => ({ update }));

    const supabase = {
      rpc: vi.fn(),
      from,
    } as unknown as Parameters<typeof useTopicEditDelete>[0]['supabase'];

    const { result } = renderHook(() =>
      useTopicEditDelete({
        topicId: 99,
        currentUser: { id: 'u1' },
        supabase,
        topic: topic.get(),
        topicPrimaryTag: topicTag.get(),
        firstPostId: 1,
        canEditTopicMeta: true,
        setTopic: topic.setter,
        setTopicPrimaryTag: topicTag.setter,
        setPosts: posts.setter,
        setRefreshTick: refreshTick.setter,
      })
    );

    act(() => {
      result.current.startEdit(makePost(2));
      result.current.setDeleteConfirmId(2);
    });

    await act(async () => {
      await result.current.handleEditSave(2, 'Edited second post', '');
    });

    expect(posts.get()[1]?.content).toBe('Edited second post');
    expect(result.current.editingPostId).toBeNull();

    await act(async () => {
      await result.current.handleDelete(2);
    });

    expect(posts.get()[1]?.deleted_at).toBe('2026-02-22T12:00:00.000Z');
    expect(result.current.deleteConfirmId).toBeNull();
  });
});
