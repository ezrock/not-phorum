-- Single-tag topics:
-- - Topic creation allows at most one tag.
-- - If no tag is provided, fallback to canonical "off-topic" tag.
-- - Topic author and admins can replace topic primary tag.

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
  selected_tag_id bigint;
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

  IF COALESCE(array_length(canonical_tag_ids, 1), 0) > 1 THEN
    RAISE EXCEPTION 'Only one tag is allowed';
  END IF;

  selected_tag_id := canonical_tag_ids[1];

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

  INSERT INTO topics (title, category_id, author_id)
  VALUES (normalized_title, input_category_id, current_user_id)
  RETURNING id INTO new_topic_id;

  INSERT INTO posts (topic_id, author_id, content, image_url)
  VALUES (new_topic_id, current_user_id, normalized_content, NULLIF(input_image_url, ''));

  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  VALUES (new_topic_id, selected_tag_id, current_user_id)
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  RETURN new_topic_id;
END;
$$;

DROP FUNCTION IF EXISTS set_topic_primary_tag(bigint, bigint);
CREATE OR REPLACE FUNCTION set_topic_primary_tag(
  input_topic_id bigint,
  input_tag_id bigint DEFAULT NULL
)
RETURNS TABLE (
  tag_id bigint,
  tag_name text,
  tag_slug text,
  tag_icon text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  topic_author_id uuid;
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

  DELETE FROM topic_tags tt
  WHERE tt.topic_id = input_topic_id;

  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  VALUES (input_topic_id, selected_tag_id, auth.uid())
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  RETURN QUERY
  SELECT
    t.id AS tag_id,
    t.name AS tag_name,
    t.slug AS tag_slug,
    COALESCE(NULLIF(btrim(t.icon), ''), '🏷️') AS tag_icon
  FROM tags t
  WHERE t.id = selected_tag_id;
END;
$$;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION set_topic_primary_tag(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_topic_primary_tag(bigint, bigint) TO authenticated;
