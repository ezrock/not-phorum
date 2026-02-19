-- Add unread_count to topic list RPCs so UI can show "N uutta".

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
  unread_count bigint,
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
    COALESCE(primary_tag.name, 'Tagit') AS category_name,
    COALESCE(primary_tag.icon, '🏷️') AS category_icon,
    pr.username AS author_username,
    GREATEST(COALESCE(pc.messages_count, 0) - 1, 0) AS replies_count,
    lp.last_post_id,
    lp.last_post_created_at,
    COALESCE(unread_stats.unread_count, 0) AS unread_count,
    COALESCE(unread_stats.unread_count, 0) > 0 AS has_new
  FROM topics t
  JOIN profiles pr ON pr.id = t.author_id
  LEFT JOIN post_counts pc ON pc.topic_id = t.id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  LEFT JOIN my_views mv ON mv.topic_id = t.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS unread_count
    FROM posts p_unread
    WHERE p_unread.topic_id = t.id
      AND p_unread.deleted_at IS NULL
      AND p_unread.author_id <> auth.uid()
      AND (mv.last_viewed_at IS NULL OR p_unread.created_at > mv.last_viewed_at)
  ) unread_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      tag_row.name,
      COALESCE(NULLIF(btrim(tag_row.icon), ''), '🏷️') AS icon
    FROM topic_tags tt
    JOIN tags tag_row ON tag_row.id = tt.tag_id
    WHERE tt.topic_id = t.id
      AND tag_row.redirect_to_tag_id IS NULL
      AND tag_row.status <> 'hidden'
    ORDER BY tt.created_at ASC, tt.tag_id ASC
    LIMIT 1
  ) primary_tag ON true
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
  unread_count bigint,
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
    COALESCE(primary_tag.name, 'Tagit') AS category_name,
    COALESCE(primary_tag.icon, '🏷️') AS category_icon,
    pr.username AS author_username,
    GREATEST(COALESCE(pc.messages_count, 0) - 1, 0) AS replies_count,
    lp.last_post_id,
    lp.last_post_created_at,
    COALESCE(unread_stats.unread_count, 0) AS unread_count,
    COALESCE(unread_stats.unread_count, 0) > 0 AS has_new
  FROM topics t
  JOIN matching_topics mt ON mt.id = t.id
  JOIN profiles pr ON pr.id = t.author_id
  LEFT JOIN post_counts pc ON pc.topic_id = t.id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  LEFT JOIN my_views mv ON mv.topic_id = t.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS unread_count
    FROM posts p_unread
    WHERE p_unread.topic_id = t.id
      AND p_unread.deleted_at IS NULL
      AND p_unread.author_id <> auth.uid()
      AND (mv.last_viewed_at IS NULL OR p_unread.created_at > mv.last_viewed_at)
  ) unread_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      tag_row.name,
      COALESCE(NULLIF(btrim(tag_row.icon), ''), '🏷️') AS icon
    FROM topic_tags tt
    JOIN tags tag_row ON tag_row.id = tt.tag_id
    WHERE tt.topic_id = t.id
      AND tag_row.redirect_to_tag_id IS NULL
      AND tag_row.status <> 'hidden'
    ORDER BY tt.created_at ASC, tt.tag_id ASC
    LIMIT 1
  ) primary_tag ON true
  ORDER BY COALESCE(lp.last_post_created_at, t.created_at) DESC, t.id DESC
  OFFSET offset_count
  LIMIT normalized_page_size;
END;
$$;

REVOKE ALL ON FUNCTION get_topic_list_state(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state(integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state_filtered(integer, integer, bigint[], boolean) TO authenticated;
