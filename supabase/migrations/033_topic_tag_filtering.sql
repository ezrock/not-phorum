-- Topic list filtering by tags (any/all) + indexes for tag-filter workloads.

CREATE INDEX IF NOT EXISTS idx_topic_tags_tag_topic_created_at
  ON topic_tags (tag_id, topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topic_tags_topic_tag_created_at
  ON topic_tags (topic_id, tag_id, created_at DESC);

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
  normalized_tag_ids bigint[] := ARRAY(
    SELECT DISTINCT unnest(COALESCE(input_tag_ids, ARRAY[]::bigint[]))
  );
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
  normalized_tag_ids bigint[] := ARRAY(
    SELECT DISTINCT unnest(COALESCE(input_tag_ids, ARRAY[]::bigint[]))
  );
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

REVOKE ALL ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_count_filtered(bigint[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_count_filtered(bigint[], boolean) TO authenticated;
