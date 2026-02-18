-- Move new topic creation to tag-first flow while keeping category_id as legacy metadata.
-- Also guarantees all existing topics have category-equivalent tags.

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
  effective_category_id bigint;
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

  -- New topics are tag-first. Keep category_id only as legacy metadata.
  IF COALESCE(array_length(canonical_tag_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one tag is required';
  END IF;

  -- Legacy category_id resolution:
  -- 1) explicit input if provided
  -- 2) first selected tag whose slug matches a category slug
  -- 3) off-topic
  -- 4) first available category
  effective_category_id := input_category_id;

  IF effective_category_id IS NULL THEN
    SELECT c.id INTO effective_category_id
    FROM unnest(canonical_tag_ids) WITH ORDINALITY selected(tag_id, pos)
    JOIN tags t ON t.id = selected.tag_id
    JOIN categories c ON c.slug = t.slug
    ORDER BY selected.pos
    LIMIT 1;
  END IF;

  IF effective_category_id IS NULL THEN
    SELECT c.id INTO effective_category_id
    FROM categories c
    WHERE c.slug = 'off-topic'
    LIMIT 1;
  END IF;

  IF effective_category_id IS NULL THEN
    SELECT c.id INTO effective_category_id
    FROM categories c
    ORDER BY c.id ASC
    LIMIT 1;
  END IF;

  IF effective_category_id IS NULL THEN
    RAISE EXCEPTION 'No categories configured';
  END IF;

  INSERT INTO topics (title, category_id, author_id)
  VALUES (normalized_title, effective_category_id, current_user_id)
  RETURNING id INTO new_topic_id;

  INSERT INTO posts (topic_id, author_id, content, image_url)
  VALUES (new_topic_id, current_user_id, normalized_content, NULLIF(input_image_url, ''));

  -- Keep legacy category-equivalent tag attached for compatibility.
  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  SELECT new_topic_id, canonical.id, current_user_id
  FROM categories c
  JOIN tags category_tag ON category_tag.slug = c.slug
  JOIN tags canonical ON canonical.id = resolve_canonical_tag_id(category_tag.id)
  WHERE c.id = effective_category_id
    AND canonical.status <> 'hidden'
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  -- Attach selected tags (already canonicalized).
  INSERT INTO topic_tags (topic_id, tag_id, created_by)
  SELECT new_topic_id, canonical.id, current_user_id
  FROM tags canonical
  WHERE canonical.id = ANY(canonical_tag_ids)
    AND canonical.status <> 'hidden'
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  RETURN new_topic_id;
END;
$$;

-- Safety backfill: ensure all existing topics have category-equivalent tags.
INSERT INTO topic_tags (topic_id, tag_id, created_by)
SELECT
  t.id AS topic_id,
  canonical.id AS tag_id,
  t.author_id AS created_by
FROM topics t
JOIN categories c ON c.id = t.category_id
JOIN tags category_tag ON category_tag.slug = c.slug
JOIN tags canonical ON canonical.id = resolve_canonical_tag_id(category_tag.id)
LEFT JOIN topic_tags tt
  ON tt.topic_id = t.id
 AND tt.tag_id = canonical.id
WHERE tt.topic_id IS NULL
  AND canonical.status <> 'hidden'
ON CONFLICT (topic_id, tag_id) DO NOTHING;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text, bigint[]) TO authenticated;
