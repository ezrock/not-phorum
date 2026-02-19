export interface Topic {
  id: number;
  title: string;
  author_id: string;
  views: number;
  views_total: number | null;
  views_unique: number | null;
}

export interface TopicPrimaryTag {
  id: number;
  name: string;
  slug: string;
  icon: string;
}
