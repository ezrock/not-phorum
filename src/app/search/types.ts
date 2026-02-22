export interface SearchResult {
  result_type: 'topic' | 'post';
  topic_id: number;
  topic_title: string;
  content_snippet: string | null;
  category_name: string;
  category_icon: string;
  author_username: string;
  author_profile_image_url: string | null;
  similarity_score: number;
  created_at: string;
  last_post_created_at: string | null;
}

export interface TagHit {
  id: number;
  name: string;
  slug: string;
  icon?: string;
}

export interface TagGroupHit {
  group_id: number;
  group_name: string;
  group_slug: string;
  member_count: number;
  member_tag_ids: number[];
}

export type SearchFilter = 'all' | 'topics' | 'posts' | 'tags' | 'groups';
export type SearchSortMode = 'latest' | 'best';
