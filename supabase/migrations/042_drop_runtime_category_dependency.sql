-- Remove runtime category dependency while keeping topics.category_id as nullable legacy metadata.

ALTER TABLE topics
  ALTER COLUMN category_id DROP NOT NULL;

DO $$
DECLARE
  fk_name text;
BEGIN
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND rel.relname = 'topics'
      AND att.attname = 'category_id'
  LOOP
    EXECUTE format('ALTER TABLE topics DROP CONSTRAINT %I', fk_name);
  END LOOP;
END;
$$;

ALTER TABLE topics
  ADD CONSTRAINT topics_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES categories(id)
  ON DELETE SET NULL;

DROP FUNCTION IF EXISTS create_topic_with_post(bigint, text, text, text, bigint[]);
CREATE OR REPLACE FUNCTION create_topic_with_post(
  input_category_id bigint DEFAULT NULL,
  input_title text DEFAULT NULL,
  input_content text DEFAULT NULL,
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
  canonical_tag_ids bigint[] := resolve_canonical_tag_ids(input_tag_ids);
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

  IF COALESCE(array_length(canonical_tag_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one tag is required';
  END IF;

  INSERT INTO topics (title, category_id, author_id)
  VALUES (normalized_title, input_category_id, current_user_id)
  RETURNING id INTO new_topic_id;

  INSERT INTO posts (topic_id, author_id, content, image_url)
  VALUES (new_topic_id, current_user_id, normalized_content, NULLIF(input_image_url, ''));

  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  SELECT new_topic_id, canonical.id, current_user_id
  FROM tags canonical
  WHERE canonical.id = ANY(canonical_tag_ids)
    AND canonical.status <> 'hidden'
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  RETURN new_topic_id;
END;
$$;

DROP FUNCTION IF EXISTS get_topic_list_state();
DROP FUNCTION IF EXISTS get_topic_list_state(integer, integer);
CREATE OR REPLACE FUNCTION get_topic_list_state(
  input_page integer DEFAULT 1,
  input_page_size integer DEFAULT 20
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH last_posts AS (
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
    'Tagit'::text AS category_name,
    '🏷️'::text AS category_icon,
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
  JOIN profiles pr ON pr.id = t.author_id
  LEFT JOIN post_counts pc ON pc.topic_id = t.id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  LEFT JOIN my_views mv ON mv.topic_id = t.id
  ORDER BY COALESCE(lp.last_post_created_at, t.created_at) DESC, t.id DESC
  OFFSET offset_count
  LIMIT normalized_page_size;
END;
$$;

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
    'Tagit'::text AS category_name,
    '🏷️'::text AS category_icon,
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
  JOIN profiles pr ON pr.id = t.author_id
  LEFT JOIN post_counts pc ON pc.topic_id = t.id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  LEFT JOIN my_views mv ON mv.topic_id = t.id
  ORDER BY COALESCE(lp.last_post_created_at, t.created_at) DESC, t.id DESC
  OFFSET offset_count
  LIMIT normalized_page_size;
END;
$$;

DROP FUNCTION IF EXISTS search_forum(text, int);
CREATE OR REPLACE FUNCTION search_forum(search_term text, result_limit int DEFAULT 20)
RETURNS TABLE (
  result_type text,
  topic_id bigint,
  topic_title text,
  content_snippet text,
  category_name text,
  category_icon text,
  author_username text,
  author_avatar text,
  author_profile_image_url text,
  similarity_score real,
  created_at timestamptz,
  last_post_created_at timestamptz
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
  WITH last_posts AS (
    SELECT DISTINCT ON (p.topic_id)
      p.topic_id,
      p.created_at AS last_post_created_at
    FROM posts p
    WHERE p.deleted_at IS NULL
    ORDER BY p.topic_id, p.created_at DESC, p.id DESC
  )
  SELECT
    'topic'::text AS result_type,
    t.id AS topic_id,
    t.title AS topic_title,
    NULL::text AS content_snippet,
    'Tagit'::text AS category_name,
    '🏷️'::text AS category_icon,
    p.username AS author_username,
    NULL::text AS author_avatar,
    NULL::text AS author_profile_image_url,
    similarity(t.title, search_term) AS similarity_score,
    t.created_at,
    lp.last_post_created_at
  FROM topics t
  JOIN profiles p ON p.id = t.author_id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  WHERE similarity(t.title, search_term) > 0.1
     OR t.title ILIKE '%' || search_term || '%'

  UNION ALL

  SELECT
    'post'::text AS result_type,
    po.topic_id,
    t.title AS topic_title,
    LEFT(po.content, 200) AS content_snippet,
    'Tagit'::text AS category_name,
    '🏷️'::text AS category_icon,
    pr.username AS author_username,
    NULL::text AS author_avatar,
    NULL::text AS author_profile_image_url,
    similarity(po.content, search_term) AS similarity_score,
    po.created_at,
    lp.last_post_created_at
  FROM posts po
  JOIN topics t ON t.id = po.topic_id
  JOIN profiles pr ON pr.id = po.author_id
  LEFT JOIN last_posts lp ON lp.topic_id = po.topic_id
  WHERE po.deleted_at IS NULL
    AND (
      similarity(po.content, search_term) > 0.1
      OR po.content ILIKE '%' || search_term || '%'
    )

  ORDER BY similarity_score DESC, last_post_created_at DESC NULLS LAST, created_at DESC
  LIMIT GREATEST(COALESCE(result_limit, 20), 1);
END;
$$;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_list_state(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state(integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) TO authenticated;

REVOKE ALL ON FUNCTION search_forum(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_forum(text, int) TO authenticated;
