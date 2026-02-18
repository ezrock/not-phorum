-- Tag alias + merge support with canonical resolution.

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS redirect_to_tag_id bigint REFERENCES tags(id) ON DELETE SET NULL;

ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_status_valid;
ALTER TABLE tags
  ADD CONSTRAINT tags_status_valid CHECK (status IN ('approved', 'unreviewed', 'rejected', 'hidden'));

ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_redirect_not_self;
ALTER TABLE tags
  ADD CONSTRAINT tags_redirect_not_self CHECK (redirect_to_tag_id IS NULL OR redirect_to_tag_id <> id);

CREATE INDEX IF NOT EXISTS idx_tags_redirect_to_tag_id
  ON tags (redirect_to_tag_id);

DROP FUNCTION IF EXISTS resolve_canonical_tag_id(bigint);
CREATE OR REPLACE FUNCTION resolve_canonical_tag_id(input_tag_id bigint)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  WITH RECURSIVE chain AS (
    SELECT t.id, t.redirect_to_tag_id, 0 AS depth
    FROM tags t
    WHERE t.id = input_tag_id

    UNION ALL

    SELECT t2.id, t2.redirect_to_tag_id, c.depth + 1
    FROM chain c
    JOIN tags t2 ON t2.id = c.redirect_to_tag_id
    WHERE c.redirect_to_tag_id IS NOT NULL
      AND c.depth < 32
  )
  SELECT c.id
  FROM chain c
  WHERE c.redirect_to_tag_id IS NULL
  ORDER BY c.depth DESC
  LIMIT 1;
$$;

DROP FUNCTION IF EXISTS resolve_canonical_tag_ids(bigint[]);
CREATE OR REPLACE FUNCTION resolve_canonical_tag_ids(input_tag_ids bigint[] DEFAULT NULL)
RETURNS bigint[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT resolved.canonical_tag_id), ARRAY[]::bigint[])
  FROM (
    SELECT resolve_canonical_tag_id(source.tag_id) AS canonical_tag_id
    FROM unnest(COALESCE(input_tag_ids, ARRAY[]::bigint[])) AS source(tag_id)
  ) resolved
  JOIN tags canonical ON canonical.id = resolved.canonical_tag_id
  WHERE resolved.canonical_tag_id IS NOT NULL
    AND canonical.status <> 'hidden';
$$;

DROP FUNCTION IF EXISTS merge_tags(bigint, bigint);
CREATE OR REPLACE FUNCTION merge_tags(
  source_tag_id bigint,
  target_tag_id bigint
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  canonical_target_id bigint;
  source_row tags%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO caller_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_is_admin = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF source_tag_id IS NULL OR target_tag_id IS NULL THEN
    RAISE EXCEPTION 'Both source and target tag ids are required';
  END IF;

  canonical_target_id := resolve_canonical_tag_id(target_tag_id);
  IF canonical_target_id IS NULL THEN
    RAISE EXCEPTION 'Target tag not found';
  END IF;

  IF resolve_canonical_tag_id(source_tag_id) = canonical_target_id THEN
    RAISE EXCEPTION 'Source and target resolve to the same canonical tag';
  END IF;

  -- Move all topic-tag references to canonical target.
  INSERT INTO topic_tags (topic_id, tag_id, created_at, created_by)
  SELECT tt.topic_id, canonical_target_id, tt.created_at, tt.created_by
  FROM topic_tags tt
  WHERE tt.tag_id = source_tag_id
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  DELETE FROM topic_tags
  WHERE tag_id = source_tag_id;

  -- Repoint existing aliases that previously redirected to source.
  UPDATE tags
  SET redirect_to_tag_id = canonical_target_id
  WHERE redirect_to_tag_id = source_tag_id;

  -- Mark old tag as hidden alias to canonical target.
  UPDATE tags
  SET status = 'hidden',
      featured = false,
      redirect_to_tag_id = canonical_target_id
  WHERE id = source_tag_id
  RETURNING * INTO source_row;

  IF source_row.id IS NULL THEN
    RAISE EXCEPTION 'Source tag not found';
  END IF;

  RETURN source_row;
END;
$$;

-- Keep existing moderation RPC compatible with new hidden status + alias column.
CREATE OR REPLACE FUNCTION moderate_tag(
  input_tag_id bigint,
  input_action text
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  normalized_action text := lower(btrim(COALESCE(input_action, '')));
  updated_row tags%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO caller_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_is_admin = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF input_tag_id IS NULL THEN
    RAISE EXCEPTION 'Tag id is required';
  END IF;

  IF normalized_action = 'approve' THEN
    UPDATE tags
    SET status = 'approved', redirect_to_tag_id = NULL
    WHERE id = input_tag_id
    RETURNING * INTO updated_row;
  ELSIF normalized_action = 'hide' THEN
    UPDATE tags
    SET status = 'hidden', featured = false, redirect_to_tag_id = NULL
    WHERE id = input_tag_id
    RETURNING * INTO updated_row;
  ELSIF normalized_action = 'feature' THEN
    UPDATE tags
    SET status = 'approved', featured = true, redirect_to_tag_id = NULL
    WHERE id = input_tag_id
    RETURNING * INTO updated_row;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', input_action;
  END IF;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  RETURN updated_row;
END;
$$;

-- Keep topic creation RPC canonicalized when aliases are submitted.
DROP FUNCTION IF EXISTS create_topic_with_post(bigint, text, text, text, bigint[]);
CREATE OR REPLACE FUNCTION create_topic_with_post(
  input_category_id bigint,
  input_title text,
  input_content text,
  input_image_url text DEFAULT NULL,
  input_tag_ids bigint[] DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  new_topic_id bigint;
  normalized_title text;
  normalized_content text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF input_category_id IS NULL THEN
    RAISE EXCEPTION 'Category is required';
  END IF;

  normalized_title := btrim(COALESCE(input_title, ''));
  normalized_content := btrim(COALESCE(input_content, ''));

  IF char_length(normalized_title) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF char_length(normalized_title) < 3 THEN
    RAISE EXCEPTION 'Title must be at least 3 characters';
  END IF;

  IF char_length(normalized_content) = 0 THEN
    RAISE EXCEPTION 'Content is required';
  END IF;

  INSERT INTO topics (title, category_id, author_id)
  VALUES (normalized_title, input_category_id, current_user_id)
  RETURNING id INTO new_topic_id;

  INSERT INTO posts (topic_id, author_id, content, image_url)
  VALUES (new_topic_id, current_user_id, normalized_content, NULLIF(input_image_url, ''));

  -- Always map topic to its category-equivalent canonical tag when available.
  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  SELECT new_topic_id, canonical.id, current_user_id
  FROM categories c
  JOIN tags category_tag ON category_tag.slug = c.slug
  JOIN tags canonical ON canonical.id = resolve_canonical_tag_id(category_tag.id)
  WHERE c.id = input_category_id
    AND canonical.status <> 'hidden'
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  -- Add optional extra tags selected during topic creation (canonicalized).
  IF input_tag_ids IS NOT NULL AND COALESCE(array_length(input_tag_ids, 1), 0) > 0 THEN
    INSERT INTO topic_tags (topic_id, tag_id, created_by)
    SELECT new_topic_id, canonical.id, current_user_id
    FROM tags canonical
    WHERE canonical.id = ANY(resolve_canonical_tag_ids(input_tag_ids))
      AND canonical.status <> 'hidden'
    ON CONFLICT (topic_id, tag_id) DO NOTHING;
  END IF;

  RETURN new_topic_id;
END;
$$;

-- Keep topic filtering RPC canonicalized when alias ids are passed in.
DROP FUNCTION IF EXISTS get_topic_list_state_filtered(integer, integer, bigint[], boolean);
CREATE OR REPLACE FUNCTION get_topic_list_state_filtered(
  input_page integer DEFAULT 1,
  input_page_size integer DEFAULT 20,
  input_tag_ids bigint[] DEFAULT NULL,
  input_match_all boolean DEFAULT false
)
RETURNS TABLE (
  id bigint,
  title text,
  views bigint,
  views_unique bigint,
  created_at timestamptz,
  category_name text,
  category_icon text,
  author_username text,
  replies_count bigint,
  last_post_id bigint,
  last_post_created_at timestamptz,
  has_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_page integer := GREATEST(COALESCE(input_page, 1), 1);
  normalized_page_size integer := GREATEST(COALESCE(input_page_size, 20), 1);
  offset_count integer := (normalized_page - 1) * normalized_page_size;
  normalized_tag_ids bigint[] := resolve_canonical_tag_ids(input_tag_ids);
  normalized_tag_count integer := COALESCE(array_length(normalized_tag_ids, 1), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH matching_topics AS (
    SELECT t.id
    FROM topics t
    WHERE normalized_tag_count = 0
      OR (
        CASE
          WHEN COALESCE(input_match_all, false) THEN (
            SELECT COUNT(DISTINCT tt.tag_id)::integer
            FROM topic_tags tt
            WHERE tt.topic_id = t.id
              AND tt.tag_id = ANY(normalized_tag_ids)
          ) = normalized_tag_count
          ELSE EXISTS (
            SELECT 1
            FROM topic_tags tt
            WHERE tt.topic_id = t.id
              AND tt.tag_id = ANY(normalized_tag_ids)
          )
        END
      )
  ),
  last_posts AS (
    SELECT DISTINCT ON (p.topic_id)
      p.topic_id,
      p.id AS last_post_id,
      p.author_id AS last_post_author_id,
      p.created_at AS last_post_created_at
    FROM posts p
    WHERE p.deleted_at IS NULL
    ORDER BY p.topic_id, p.created_at DESC, p.id DESC
  ),
  post_counts AS (
    SELECT
      p.topic_id,
      COUNT(*)::bigint AS messages_count
    FROM posts p
    WHERE p.deleted_at IS NULL
    GROUP BY p.topic_id
  ),
  my_views AS (
    SELECT
      tve.topic_id,
      tve.last_viewed_at
    FROM topic_view_events tve
    WHERE tve.viewer_key = auth.uid()::text
  )
  SELECT
    t.id,
    t.title,
    COALESCE(t.views, 0) AS views,
    COALESCE(t.views_unique, 0) AS views_unique,
    t.created_at,
    c.name AS category_name,
    c.icon AS category_icon,
    pr.username AS author_username,
    GREATEST(COALESCE(pc.messages_count, 0) - 1, 0) AS replies_count,
    lp.last_post_id,
    lp.last_post_created_at,
    CASE
      WHEN lp.last_post_created_at IS NULL THEN false
      WHEN lp.last_post_author_id = auth.uid() THEN false
      WHEN mv.last_viewed_at IS NULL THEN true
      ELSE lp.last_post_created_at > mv.last_viewed_at
    END AS has_new
  FROM topics t
  JOIN matching_topics mt ON mt.id = t.id
  JOIN categories c ON c.id = t.category_id
  JOIN profiles pr ON pr.id = t.author_id
  LEFT JOIN post_counts pc ON pc.topic_id = t.id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  LEFT JOIN my_views mv ON mv.topic_id = t.id
  ORDER BY COALESCE(lp.last_post_created_at, t.created_at) DESC, t.id DESC
  OFFSET offset_count
  LIMIT normalized_page_size;
END;
$$;

DROP FUNCTION IF EXISTS get_topic_count_filtered(bigint[], boolean);
CREATE OR REPLACE FUNCTION get_topic_count_filtered(
  input_tag_ids bigint[] DEFAULT NULL,
  input_match_all boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_tag_ids bigint[] := resolve_canonical_tag_ids(input_tag_ids);
  normalized_tag_count integer := COALESCE(array_length(normalized_tag_ids, 1), 0);
  total_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*)::bigint INTO total_count
  FROM topics t
  WHERE normalized_tag_count = 0
    OR (
      CASE
        WHEN COALESCE(input_match_all, false) THEN (
          SELECT COUNT(DISTINCT tt.tag_id)::integer
          FROM topic_tags tt
          WHERE tt.topic_id = t.id
            AND tt.tag_id = ANY(normalized_tag_ids)
        ) = normalized_tag_count
        ELSE EXISTS (
          SELECT 1
          FROM topic_tags tt
          WHERE tt.topic_id = t.id
            AND tt.tag_id = ANY(normalized_tag_ids)
        )
      END
    );

  RETURN COALESCE(total_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION resolve_canonical_tag_id(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_canonical_tag_id(bigint) TO authenticated;

REVOKE ALL ON FUNCTION resolve_canonical_tag_ids(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_canonical_tag_ids(bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION merge_tags(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_tags(bigint, bigint) TO authenticated;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_count_filtered(bigint[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_count_filtered(bigint[], boolean) TO authenticated;
