export interface PendingUser {
  id: string;
  username: string;
  created_at: string;
}

export interface UnreviewedTag {
  id: number;
  name: string;
  slug: string;
  status: 'unreviewed' | 'approved' | 'rejected' | 'hidden';
  featured: boolean;
  usage_count: number;
  created_at: string;
}

export interface CanonicalTagOption {
  id: number;
  name: string;
  slug: string;
  legacy_icon_path: string | null;
  usage_count: number;
  alias_count: number;
  group_membership_count: number;
  redirect_reference_count: number;
}

export interface TagAliasRow {
  alias_id: number;
  tag_id: number;
  tag_name: string;
  tag_slug: string;
  alias: string;
  normalized_alias: string;
  created_at: string;
}

export interface TagGroupAliasRow {
  alias_id: number;
  group_id: number;
  group_name: string;
  group_slug: string;
  alias: string;
  normalized_alias: string;
  created_at: string;
}

export interface AdminTagGroup {
  group_id: number;
  group_name: string;
  group_slug: string;
  description: string | null;
  searchable: boolean;
  group_kind: 'search' | 'arrangement' | 'both';
  arrangement_order: number;
  member_count: number;
  member_tag_ids: number[];
}

export type TagModerationAction = 'approve' | 'hide' | 'feature';
