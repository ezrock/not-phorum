-- Quote likes on forum front page + Loki event feed support

CREATE TABLE IF NOT EXISTS quote_likes (
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_likes_post_created
  ON quote_likes(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_likes_profile_created
  ON quote_likes(profile_id, created_at DESC);

ALTER TABLE quote_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_likes_select_authenticated" ON quote_likes;
CREATE POLICY "quote_likes_select_authenticated"
  ON quote_likes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "quote_likes_insert_own" ON quote_likes;
CREATE POLICY "quote_likes_insert_own"
  ON quote_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "quote_likes_delete_own" ON quote_likes;
CREATE POLICY "quote_likes_delete_own"
  ON quote_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE TABLE IF NOT EXISTS quote_like_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  topic_id bigint NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  liked_by_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_like_events_created_at
  ON quote_like_events(created_at DESC);

ALTER TABLE quote_like_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_like_events_select_authenticated" ON quote_like_events;
CREATE POLICY "quote_like_events_select_authenticated"
  ON quote_like_events
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "quote_like_events_no_direct_insert" ON quote_like_events;
CREATE POLICY "quote_like_events_no_direct_insert"
  ON quote_like_events
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION toggle_quote_like(target_post_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id uuid;
  target_topic_id bigint;
  is_liked boolean := false;
  likes_count bigint := 0;
BEGIN
  caller_profile_id := auth.uid();

  IF caller_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.topic_id INTO target_topic_id
  FROM posts p
  WHERE p.id = target_post_id
    AND p.deleted_at IS NULL;

  IF target_topic_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM quote_likes ql
    WHERE ql.post_id = target_post_id
      AND ql.profile_id = caller_profile_id
  ) THEN
    DELETE FROM quote_likes
    WHERE post_id = target_post_id
      AND profile_id = caller_profile_id;

    is_liked := false;
  ELSE
    INSERT INTO quote_likes (post_id, profile_id)
    VALUES (target_post_id, caller_profile_id);

    INSERT INTO quote_like_events (post_id, topic_id, liked_by_profile_id)
    VALUES (target_post_id, target_topic_id, caller_profile_id);

    is_liked := true;
  END IF;

  SELECT COUNT(*)::bigint INTO likes_count
  FROM quote_likes
  WHERE post_id = target_post_id;

  RETURN jsonb_build_object(
    'liked', is_liked,
    'likes_count', likes_count
  );
END;
$$;

REVOKE ALL ON FUNCTION toggle_quote_like(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION toggle_quote_like(bigint) TO authenticated;
