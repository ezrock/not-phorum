-- Post likes + profile Top 5 helper RPCs

CREATE TABLE IF NOT EXISTS post_likes (
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, profile_id)
);

-- Compatibility repair for environments where post_likes already exists
-- with older column naming (e.g. user_id).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_likes'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_likes'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.post_likes RENAME COLUMN user_id TO profile_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_likes'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.post_likes ADD COLUMN profile_id uuid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'post_likes'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE 'ALTER TABLE public.post_likes ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'post_likes_profile_id_fkey'
      AND conrelid = 'public.post_likes'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.post_likes
      ADD CONSTRAINT post_likes_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE contype = 'p'
      AND conrelid = 'public.post_likes'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.post_likes
      ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, profile_id)';
  END IF;
END
$$;

ALTER TABLE post_likes
  ALTER COLUMN profile_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_likes_profile_created
  ON post_likes(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_created
  ON post_likes(post_id, created_at DESC);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_likes_select_authenticated" ON post_likes;
CREATE POLICY "post_likes_select_authenticated"
  ON post_likes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "post_likes_insert_own" ON post_likes;
CREATE POLICY "post_likes_insert_own"
  ON post_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "post_likes_delete_own" ON post_likes;
CREATE POLICY "post_likes_delete_own"
  ON post_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE OR REPLACE FUNCTION get_profile_top_liked_posts(
  target_profile_id uuid,
  result_limit int DEFAULT 5
)
RETURNS TABLE (
  post_id bigint,
  topic_id bigint,
  topic_title text,
  content_preview text,
  likes_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS post_id,
    t.id AS topic_id,
    t.title AS topic_title,
    LEFT(TRIM(p.content), 180) AS content_preview,
    COUNT(pl.profile_id)::bigint AS likes_count
  FROM posts p
  JOIN topics t ON t.id = p.topic_id
  LEFT JOIN post_likes pl ON pl.post_id = p.id
  WHERE p.author_id = target_profile_id
    AND p.deleted_at IS NULL
  GROUP BY p.id, t.id, t.title, p.content, p.created_at
  ORDER BY COUNT(pl.profile_id) DESC, p.created_at DESC
  LIMIT GREATEST(COALESCE(result_limit, 5), 1);
END;
$$;

REVOKE ALL ON FUNCTION get_profile_top_liked_posts(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_profile_top_liked_posts(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION get_profile_top_liked_authors(
  target_profile_id uuid,
  result_limit int DEFAULT 5
)
RETURNS TABLE (
  author_id uuid,
  username text,
  profile_image_url text,
  likes_given bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    pr.id AS author_id,
    pr.username,
    pr.profile_image_url,
    COUNT(*)::bigint AS likes_given
  FROM post_likes pl
  JOIN posts p ON p.id = pl.post_id
  JOIN profiles pr ON pr.id = p.author_id
  WHERE pl.profile_id = target_profile_id
    AND p.deleted_at IS NULL
    AND p.author_id <> target_profile_id
  GROUP BY pr.id, pr.username, pr.profile_image_url
  ORDER BY COUNT(*) DESC, pr.username ASC
  LIMIT GREATEST(COALESCE(result_limit, 5), 1);
END;
$$;

REVOKE ALL ON FUNCTION get_profile_top_liked_authors(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_profile_top_liked_authors(uuid, int) TO authenticated;
