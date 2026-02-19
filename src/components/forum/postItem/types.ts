export interface Post {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
    created_at: string;
    signature: string | null;
    show_signature: boolean;
  } | null;
}
