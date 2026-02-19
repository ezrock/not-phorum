import type { Post } from '@/components/forum/post';
import type { Topic } from '@/components/forum/types';
import type { SupabaseJoinField } from '@/lib/supabase/normalizeJoin';
import { normalizeJoin } from '@/lib/supabase/normalizeJoin';

export interface RawPostRow {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author: SupabaseJoinField<Post['author']>;
}

export interface RawTopicRow {
  id: number;
  title: string;
  author_id: string;
  views: number;
  views_total: number | null;
  views_unique: number | null;
}

export interface AroundPostRow {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author_id: string | null;
  author_username: string | null;
  author_profile_image_url: string | null;
  author_created_at: string | null;
  author_signature: string | null;
  author_show_signature: boolean | null;
  post_row_number: number;
  total_rows: number;
}

export function parsePostRow(row: RawPostRow): Post {
  return { ...row, author: normalizeJoin(row.author) ?? null };
}

export function parseTopicRow(row: RawTopicRow): Topic {
  return { ...row };
}

export function parseAroundPostRow(row: AroundPostRow): Post {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    image_url: row.image_url,
    author: row.author_id
      ? {
          id: row.author_id,
          username: row.author_username || 'tuntematon',
          profile_image_url: row.author_profile_image_url,
          created_at: row.author_created_at || row.created_at,
          signature: row.author_signature,
          show_signature: row.author_show_signature === true,
        }
      : null,
  };
}
