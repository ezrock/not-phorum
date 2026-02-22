export type EventType = 'image' | 'video' | 'url' | 'quote';
export type FilterType = 'all' | 'image' | 'video' | 'url' | 'quote';
export const LOKI_FILTERS: FilterType[] = ['all', 'image', 'video', 'url', 'quote'];

export interface EventItem {
  id: string;
  type: EventType;
  created_at: string;
  topic_id: number;
  post_id?: number;
  topic_title: string;
  content_preview?: string;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
  image_url?: string;
  urls?: string[];
  quote_preview?: string;
}

export interface RawPostRow {
  id: number;
  content: string;
  created_at: string;
  image_url: string | null;
  topic_id: number;
  topic: { title: string } | null;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
}

export interface RawQuoteLikeEventRow {
  id: number;
  created_at: string;
  post_id: number;
  topic_id: number;
  topic: { title: string }[] | { title: string } | null;
  post: { content: string }[] | { content: string } | null;
  actor: {
    id: string;
    username: string;
    profile_image_url: string | null;
  }[] | {
    id: string;
    username: string;
    profile_image_url: string | null;
  } | null;
}
