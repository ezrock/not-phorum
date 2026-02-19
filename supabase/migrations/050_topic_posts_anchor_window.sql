-- Fetch a centered message window around a specific post id inside a topic.

DROP FUNCTION IF EXISTS get_topic_posts_around(bigint, bigint, integer, integer);
CREATE OR REPLACE FUNCTION get_topic_posts_around(
  input_topic_id bigint,
  input_post_id bigint,
  input_before integer DEFAULT 20,
  input_after integer DEFAULT 20
)
RETURNS TABLE (
  id bigint,
  content text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  image_url text,
  author_id uuid,
  author_username text,
  author_profile_image_url text,
  author_created_at timestamptz,
  author_signature text,
  author_show_signature boolean,
  post_row_number integer,
  total_rows integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_before integer := GREATEST(COALESCE(input_before, 20), 0);
  normalized_after integer := GREATEST(COALESCE(input_after, 20), 0);
  target_row_number integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF input_topic_id IS NULL OR input_post_id IS NULL THEN
    RAISE EXCEPTION 'Topic id and post id are required';
  END IF;

  WITH ordered_posts AS (
    SELECT
      p.id,
      row_number() OVER (ORDER BY p.created_at ASC, p.id ASC)::integer AS rn
    FROM posts p
    WHERE p.topic_id = input_topic_id
  )
  SELECT op.rn
  INTO target_row_number
  FROM ordered_posts op
  WHERE op.id = input_post_id
  LIMIT 1;

  IF target_row_number IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ordered_posts AS (
    SELECT
      p.id,
      p.content,
      p.created_at,
      p.updated_at,
      p.deleted_at,
      p.image_url,
      p.author_id,
      row_number() OVER (ORDER BY p.created_at ASC, p.id ASC)::integer AS rn,
      count(*) OVER ()::integer AS total_rows
    FROM posts p
    WHERE p.topic_id = input_topic_id
  )
  SELECT
    op.id,
    op.content,
    op.created_at,
    op.updated_at,
    op.deleted_at,
    op.image_url,
    pr.id AS author_id,
    pr.username AS author_username,
    pr.profile_image_url AS author_profile_image_url,
    pr.created_at AS author_created_at,
    pr.signature AS author_signature,
    COALESCE(pr.show_signature, false) AS author_show_signature,
    op.rn AS post_row_number,
    op.total_rows
  FROM ordered_posts op
  LEFT JOIN profiles pr ON pr.id = op.author_id
  WHERE op.rn BETWEEN GREATEST(1, target_row_number - normalized_before)
                 AND LEAST(op.total_rows, target_row_number + normalized_after)
  ORDER BY op.rn ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_topic_posts_around(bigint, bigint, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_posts_around(bigint, bigint, integer, integer) TO authenticated;
