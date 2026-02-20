-- User-level hidden tags / tag-groups for forum topic list filtering.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hidden_tag_ids bigint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hidden_tag_group_ids bigint[] NOT NULL DEFAULT '{}';

DROP FUNCTION IF EXISTS get_topic_list_state_filtered_with_exclusions(integer, integer, bigint[], boolean, bigint[]);
CREATE OR REPLACE FUNCTION get_topic_list_state_filtered_with_exclusions(
  input_page integer DEFAULT 1,
  input_page_size integer DEFAULT 20,
  input_tag_ids bigint[] DEFAULT NULL,
  input_match_all boolean DEFAULT false,
  input_excluded_tag_ids bigint[] DEFAULT NULL
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
  jump_post_id bigint,
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
  normalized_excluded_tag_ids bigint[] := resolve_canonical_tag_ids(input_excluded_tag_ids);
  normalized_excluded_tag_count integer := COALESCE(array_length(normalized_excluded_tag_ids, 1), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH matching_topics AS (
    SELECT t.id
    FROM topics t
    WHERE (
      normalized_tag_count = 0
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
    )
    AND (
      normalized_excluded_tag_count = 0
      OR NOT EXISTS (
        SELECT 1
        FROM topic_tags tt
        WHERE tt.topic_id = t.id
          AND tt.tag_id = ANY(normalized_excluded_tag_ids)
      )
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
  ordered_topics AS (
    SELECT
      t.id,
      t.title,
      t.views,
      t.views_unique,
      t.created_at,
      t.author_id,
      lp.last_post_id,
      lp.last_post_created_at
    FROM topics t
    JOIN matching_topics mt ON mt.id = t.id
    LEFT JOIN last_posts lp ON lp.topic_id = t.id
    ORDER BY COALESCE(lp.last_post_created_at, t.created_at) DESC, t.id DESC
    OFFSET offset_count
    LIMIT normalized_page_size
  ),
  post_counts AS (
    SELECT
      p.topic_id,
      COUNT(*)::bigint AS messages_count
    FROM posts p
    JOIN ordered_topics ot ON ot.id = p.topic_id
    WHERE p.deleted_at IS NULL
    GROUP BY p.topic_id
  ),
  my_views AS (
    SELECT
      tve.topic_id,
      tve.last_viewed_at
    FROM topic_view_events tve
    JOIN ordered_topics ot ON ot.id = tve.topic_id
    WHERE tve.viewer_key = auth.uid()::text
  ),
  unread_source AS (
    SELECT
      p.topic_id,
      p.id,
      p.created_at
    FROM posts p
    JOIN ordered_topics ot ON ot.id = p.topic_id
    LEFT JOIN my_views mv ON mv.topic_id = p.topic_id
    WHERE p.deleted_at IS NULL
      AND p.author_id <> auth.uid()
      AND (mv.last_viewed_at IS NULL OR p.created_at > mv.last_viewed_at)
  ),
  unread_counts AS (
    SELECT
      us.topic_id,
      COUNT(*)::bigint AS unread_count
    FROM unread_source us
    GROUP BY us.topic_id
  ),
  unread_first AS (
    SELECT DISTINCT ON (us.topic_id)
      us.topic_id,
      us.id AS post_id
    FROM unread_source us
    ORDER BY us.topic_id, us.created_at ASC, us.id ASC
  ),
  primary_tags AS (
    SELECT DISTINCT ON (tt.topic_id)
      tt.topic_id,
      tag_row.name,
      COALESCE(NULLIF(btrim(tag_row.icon), ''), '🏷️') AS icon
    FROM topic_tags tt
    JOIN ordered_topics ot ON ot.id = tt.topic_id
    JOIN tags tag_row ON tag_row.id = tt.tag_id
    WHERE tag_row.redirect_to_tag_id IS NULL
      AND tag_row.status <> 'hidden'
    ORDER BY tt.topic_id, tt.created_at ASC, tt.tag_id ASC
  )
  SELECT
    ot.id,
    ot.title,
    COALESCE(ot.views, 0) AS views,
    COALESCE(ot.views_unique, 0) AS views_unique,
    ot.created_at,
    COALESCE(pt.name, 'Tagit') AS category_name,
    COALESCE(pt.icon, '🏷️') AS category_icon,
    pr.username AS author_username,
    GREATEST(COALESCE(pc.messages_count, 0) - 1, 0) AS replies_count,
    ot.last_post_id,
    ot.last_post_created_at,
    COALESCE(uf.post_id, ot.last_post_id) AS jump_post_id,
    COALESCE(uc.unread_count, 0) AS unread_count,
    COALESCE(uc.unread_count, 0) > 0 AS has_new
  FROM ordered_topics ot
  JOIN profiles pr ON pr.id = ot.author_id
  LEFT JOIN post_counts pc ON pc.topic_id = ot.id
  LEFT JOIN unread_counts uc ON uc.topic_id = ot.id
  LEFT JOIN unread_first uf ON uf.topic_id = ot.id
  LEFT JOIN primary_tags pt ON pt.topic_id = ot.id
  ORDER BY COALESCE(ot.last_post_created_at, ot.created_at) DESC, ot.id DESC;
END;
$$;

DROP FUNCTION IF EXISTS get_topic_count_filtered_with_exclusions(bigint[], boolean, bigint[]);
CREATE OR REPLACE FUNCTION get_topic_count_filtered_with_exclusions(
  input_tag_ids bigint[] DEFAULT NULL,
  input_match_all boolean DEFAULT false,
  input_excluded_tag_ids bigint[] DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_tag_ids bigint[] := resolve_canonical_tag_ids(input_tag_ids);
  normalized_tag_count integer := COALESCE(array_length(normalized_tag_ids, 1), 0);
  normalized_excluded_tag_ids bigint[] := resolve_canonical_tag_ids(input_excluded_tag_ids);
  normalized_excluded_tag_count integer := COALESCE(array_length(normalized_excluded_tag_ids, 1), 0);
  total_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*)::bigint INTO total_count
  FROM topics t
  WHERE (
    normalized_tag_count = 0
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
  )
  AND (
    normalized_excluded_tag_count = 0
    OR NOT EXISTS (
      SELECT 1
      FROM topic_tags tt
      WHERE tt.topic_id = t.id
        AND tt.tag_id = ANY(normalized_excluded_tag_ids)
    )
  );

  RETURN COALESCE(total_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION get_topic_list_state_filtered_with_exclusions(integer, integer, bigint[], boolean, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_list_state_filtered_with_exclusions(integer, integer, bigint[], boolean, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION get_topic_count_filtered_with_exclusions(bigint[], boolean, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_count_filtered_with_exclusions(bigint[], boolean, bigint[]) TO authenticated;
