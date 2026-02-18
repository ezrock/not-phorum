-- Extend topic creation RPC to accept optional tag ids and persist them atomically.
-- Keeps category_id unchanged and required.

DROP FUNCTION IF EXISTS create_topic_with_post(bigint, text, text, text);

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

  -- Always map topic to its category-equivalent tag when available.
  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  SELECT new_topic_id, tg.id, current_user_id
  FROM categories c
  JOIN tags tg ON tg.slug = c.slug
  WHERE c.id = input_category_id
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  -- Add optional extra tags selected during topic creation.
  IF input_tag_ids IS NOT NULL AND COALESCE(array_length(input_tag_ids, 1), 0) > 0 THEN
    INSERT INTO topic_tags (topic_id, tag_id, created_by)
    SELECT new_topic_id, tg.id, current_user_id
    FROM tags tg
    WHERE tg.id = ANY(input_tag_ids)
    ON CONFLICT (topic_id, tag_id) DO NOTHING;
  END IF;

  RETURN new_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) TO authenticated;
