-- Add last_post_created_at to search results and order by latest activity

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
    c.name AS category_name,
    c.icon AS category_icon,
    p.username AS author_username,
    NULL::text AS author_avatar,
    NULL::text AS author_profile_image_url,
    similarity(t.title, search_term) AS similarity_score,
    t.created_at,
    lp.last_post_created_at
  FROM topics t
  JOIN categories c ON c.id = t.category_id
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
    c.name AS category_name,
    c.icon AS category_icon,
    pr.username AS author_username,
    NULL::text AS author_avatar,
    NULL::text AS author_profile_image_url,
    similarity(po.content, search_term) AS similarity_score,
    po.created_at,
    lp.last_post_created_at
  FROM posts po
  JOIN topics t ON t.id = po.topic_id
  JOIN categories c ON c.id = t.category_id
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

REVOKE ALL ON FUNCTION search_forum(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_forum(text, int) TO authenticated;
