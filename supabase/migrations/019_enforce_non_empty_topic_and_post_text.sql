-- Enforce non-empty topic title and post content after trimming whitespace.
-- Keeps existing max lengths and topic title minimum length (3).

ALTER TABLE topics DROP CONSTRAINT IF EXISTS title_length;
ALTER TABLE topics
  ADD CONSTRAINT title_length
  CHECK (char_length(btrim(title)) >= 3 AND char_length(btrim(title)) <= 200);

ALTER TABLE posts DROP CONSTRAINT IF EXISTS content_length;
ALTER TABLE posts
  ADD CONSTRAINT content_length
  CHECK (char_length(btrim(content)) >= 1 AND char_length(btrim(content)) <= 10000);

CREATE OR REPLACE FUNCTION create_topic_with_post(
  input_category_id bigint,
  input_title text,
  input_content text,
  input_image_url text DEFAULT NULL
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

  RETURN new_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text) TO authenticated;
