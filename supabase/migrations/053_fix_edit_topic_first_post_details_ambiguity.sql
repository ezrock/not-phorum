-- Fix PL/pgSQL ambiguity with RETURNS TABLE column names (topic_id/tag_id).

DROP FUNCTION IF EXISTS edit_topic_first_post_details(bigint, text, text, text, bigint);
CREATE OR REPLACE FUNCTION edit_topic_first_post_details(
  input_topic_id bigint,
  input_title text,
  input_content text,
  input_image_url text DEFAULT NULL,
  input_tag_id bigint DEFAULT NULL
)
RETURNS TABLE (
  topic_id bigint,
  topic_title text,
  post_id bigint,
  post_content text,
  post_image_url text,
  tag_id bigint,
  tag_name text,
  tag_slug text,
  tag_icon text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  caller_is_admin boolean := false;
  topic_author_id uuid;
  first_post_id bigint;
  normalized_title text := btrim(COALESCE(input_title, ''));
  normalized_content text := btrim(COALESCE(input_content, ''));
  selected_tag_id bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF input_topic_id IS NULL THEN
    RAISE EXCEPTION 'Topic id is required';
  END IF;

  SELECT t.author_id
  INTO topic_author_id
  FROM topics t
  WHERE t.id = input_topic_id;

  IF topic_author_id IS NULL THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO caller_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_is_admin = false AND topic_author_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF char_length(normalized_title) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF char_length(normalized_title) < 3 THEN
    RAISE EXCEPTION 'Title must be at least 3 characters';
  END IF;
  IF char_length(normalized_title) > 200 THEN
    RAISE EXCEPTION 'Title is too long';
  END IF;

  IF char_length(normalized_content) = 0 THEN
    RAISE EXCEPTION 'Content is required';
  END IF;

  SELECT p.id
  INTO first_post_id
  FROM posts p
  WHERE p.topic_id = input_topic_id
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT 1;

  IF first_post_id IS NULL THEN
    RAISE EXCEPTION 'First post not found';
  END IF;

  IF input_tag_id IS NOT NULL THEN
    selected_tag_id := resolve_canonical_tag_id(input_tag_id);
  END IF;

  IF selected_tag_id IS NULL THEN
    SELECT resolve_canonical_tag_id(t.id)
    INTO selected_tag_id
    FROM tags t
    WHERE t.slug = 'off-topic'
      AND t.status <> 'hidden'
    ORDER BY t.id ASC
    LIMIT 1;
  END IF;

  IF selected_tag_id IS NULL THEN
    RAISE EXCEPTION 'Off-topic tag not configured';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tags t
    WHERE t.id = selected_tag_id
      AND t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
  ) THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  UPDATE topics t
  SET title = normalized_title
  WHERE t.id = input_topic_id;

  UPDATE posts p
  SET content = normalized_content,
      image_url = NULLIF(input_image_url, ''),
      updated_at = now()
  WHERE p.id = first_post_id;

  DELETE FROM topic_tags tt
  WHERE tt.topic_id = input_topic_id;

  INSERT INTO topic_tags AS tt (topic_id, tag_id, created_by)
  VALUES (input_topic_id, selected_tag_id, auth.uid())
  ON CONFLICT ON CONSTRAINT topic_tags_pkey DO NOTHING;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.title AS topic_title,
    p.id AS post_id,
    p.content AS post_content,
    p.image_url AS post_image_url,
    tg.id AS tag_id,
    tg.name AS tag_name,
    tg.slug AS tag_slug,
    COALESCE(NULLIF(btrim(tg.icon), ''), '🏷️') AS tag_icon
  FROM topics t
  JOIN posts p ON p.id = first_post_id
  JOIN tags tg ON tg.id = selected_tag_id
  WHERE t.id = input_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION edit_topic_first_post_details(bigint, text, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION edit_topic_first_post_details(bigint, text, text, text, bigint) TO authenticated;
