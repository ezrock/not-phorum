-- Security hardening for RPCs and privileged actions

-- Enforce self-only updates for login counter
DROP FUNCTION IF EXISTS increment_login_count(uuid);

CREATE OR REPLACE FUNCTION increment_login_count(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE profiles
  SET login_count = COALESCE(login_count, 0) + 1
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_login_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_login_count(uuid) TO authenticated;

-- Search should only be available for authenticated users
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
  created_at timestamptz
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
  SELECT
    'topic'::text AS result_type,
    t.id AS topic_id,
    t.title AS topic_title,
    NULL::text AS content_snippet,
    c.name AS category_name,
    c.icon AS category_icon,
    p.username AS author_username,
    p.avatar AS author_avatar,
    p.profile_image_url AS author_profile_image_url,
    similarity(t.title, search_term) AS similarity_score,
    t.created_at
  FROM topics t
  JOIN categories c ON c.id = t.category_id
  JOIN profiles p ON p.id = t.author_id
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
    pr.avatar AS author_avatar,
    pr.profile_image_url AS author_profile_image_url,
    similarity(po.content, search_term) AS similarity_score,
    po.created_at
  FROM posts po
  JOIN topics t ON t.id = po.topic_id
  JOIN categories c ON c.id = t.category_id
  JOIN profiles pr ON pr.id = po.author_id
  WHERE po.deleted_at IS NULL
    AND (similarity(po.content, search_term) > 0.1
         OR po.content ILIKE '%' || search_term || '%')

  ORDER BY similarity_score DESC, created_at DESC
  LIMIT result_limit;
END;
$$;

REVOKE ALL ON FUNCTION search_forum(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_forum(text, int) TO authenticated;

-- Admin changes must be enforced on the server side
CREATE OR REPLACE FUNCTION set_user_admin(target_user_id uuid, make_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_caller_admin boolean;
  target_is_admin boolean;
  admin_total int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.is_admin INTO is_caller_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF COALESCE(is_caller_admin, false) = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT p.is_admin INTO target_is_admin
  FROM profiles p
  WHERE p.id = target_user_id;

  IF target_is_admin IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF target_is_admin = true AND make_admin = false THEN
    SELECT COUNT(*)::int INTO admin_total
    FROM profiles
    WHERE is_admin = true;

    IF admin_total <= 1 THEN
      RAISE EXCEPTION 'At least one admin is required';
    END IF;
  END IF;

  UPDATE profiles
  SET is_admin = make_admin
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION set_user_admin(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_user_admin(uuid, boolean) TO authenticated;

-- Atomic topic + first post creation
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
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF input_category_id IS NULL THEN
    RAISE EXCEPTION 'Category is required';
  END IF;

  IF input_title IS NULL OR LENGTH(TRIM(input_title)) < 3 THEN
    RAISE EXCEPTION 'Title must be at least 3 characters';
  END IF;

  IF input_content IS NULL OR LENGTH(TRIM(input_content)) < 1 THEN
    RAISE EXCEPTION 'Content is required';
  END IF;

  INSERT INTO topics (title, category_id, author_id)
  VALUES (TRIM(input_title), input_category_id, current_user_id)
  RETURNING id INTO new_topic_id;

  INSERT INTO posts (topic_id, author_id, content, image_url)
  VALUES (new_topic_id, current_user_id, TRIM(input_content), NULLIF(input_image_url, ''));

  RETURN new_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION create_topic_with_post(bigint, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_topic_with_post(bigint, text, text, text) TO authenticated;

-- Track topic views from a guarded RPC
CREATE OR REPLACE FUNCTION increment_topic_views(target_topic_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE topics
  SET views = COALESCE(views, 0) + 1
  WHERE id = target_topic_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_topic_views(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_topic_views(bigint) TO authenticated;
