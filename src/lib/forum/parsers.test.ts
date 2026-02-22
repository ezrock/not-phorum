import { describe, expect, it } from 'vitest';
import { parseAroundPostRow, parsePostRow, parseTopicRow } from '@/lib/forum/parsers';

describe('forum parsers', () => {
  it('parsePostRow normalizes joined author arrays', () => {
    const row = {
      id: 1,
      content: 'Hello',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: null,
      deleted_at: null,
      image_url: null,
      author: [
        {
          id: 'u1',
          username: 'alice',
          profile_image_url: null,
          created_at: '2020-01-01T00:00:00.000Z',
          signature: null,
          show_signature: true,
        },
      ],
    };

    const parsed = parsePostRow(row);
    expect(parsed.author?.id).toBe('u1');
    expect(parsed.author?.username).toBe('alice');
  });

  it('parseTopicRow returns topic shape unchanged', () => {
    const row = {
      id: 11,
      title: 'Topic',
      author_id: 'u1',
      views: 5,
      views_total: 10,
      views_unique: 7,
    };

    expect(parseTopicRow(row)).toEqual(row);
  });

  it('parseAroundPostRow maps author and defaults username/created_at correctly', () => {
    const row = {
      id: 3,
      content: 'Around',
      created_at: '2026-01-02T00:00:00.000Z',
      updated_at: null,
      deleted_at: null,
      image_url: null,
      author_id: 'u2',
      author_username: null,
      author_profile_image_url: null,
      author_created_at: null,
      author_signature: 'sig',
      author_show_signature: true,
      post_row_number: 2,
      total_rows: 100,
    };

    const parsed = parseAroundPostRow(row);
    expect(parsed.author).toEqual({
      id: 'u2',
      username: 'tuntematon',
      profile_image_url: null,
      created_at: '2026-01-02T00:00:00.000Z',
      signature: 'sig',
      show_signature: true,
    });
  });

  it('parseAroundPostRow returns null author when author_id is missing', () => {
    const row = {
      id: 4,
      content: 'No author',
      created_at: '2026-01-03T00:00:00.000Z',
      updated_at: null,
      deleted_at: null,
      image_url: null,
      author_id: null,
      author_username: null,
      author_profile_image_url: null,
      author_created_at: null,
      author_signature: null,
      author_show_signature: null,
      post_row_number: 1,
      total_rows: 1,
    };

    const parsed = parseAroundPostRow(row);
    expect(parsed.author).toBeNull();
  });
});
