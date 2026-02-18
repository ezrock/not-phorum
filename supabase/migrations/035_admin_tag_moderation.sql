-- Admin helpers for tag moderation workflow.

DROP FUNCTION IF EXISTS get_unreviewed_tags_with_usage();
CREATE OR REPLACE FUNCTION get_unreviewed_tags_with_usage()
RETURNS TABLE (
  id bigint,
  name text,
  slug text,
  status text,
  featured boolean,
  usage_count bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO caller_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_is_admin = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.status,
    t.featured,
    COUNT(tt.topic_id)::bigint AS usage_count,
    t.created_at
  FROM tags t
  LEFT JOIN topic_tags tt ON tt.tag_id = t.id
  WHERE t.status = 'unreviewed'
  GROUP BY t.id, t.name, t.slug, t.status, t.featured, t.created_at
  ORDER BY COUNT(tt.topic_id) DESC, t.created_at ASC, t.id ASC;
END;
$$;

DROP FUNCTION IF EXISTS moderate_tag(bigint, text);
CREATE OR REPLACE FUNCTION moderate_tag(
  input_tag_id bigint,
  input_action text
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  normalized_action text := lower(btrim(COALESCE(input_action, '')));
  updated_row tags%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO caller_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_is_admin = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF input_tag_id IS NULL THEN
    RAISE EXCEPTION 'Tag id is required';
  END IF;

  IF normalized_action = 'approve' THEN
    UPDATE tags
    SET status = 'approved'
    WHERE id = input_tag_id
    RETURNING * INTO updated_row;
  ELSIF normalized_action = 'hide' THEN
    UPDATE tags
    SET status = 'rejected', featured = false
    WHERE id = input_tag_id
    RETURNING * INTO updated_row;
  ELSIF normalized_action = 'feature' THEN
    UPDATE tags
    SET status = 'approved', featured = true
    WHERE id = input_tag_id
    RETURNING * INTO updated_row;
  ELSE
    RAISE EXCEPTION 'Unknown action: %', input_action;
  END IF;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION get_unreviewed_tags_with_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_unreviewed_tags_with_usage() TO authenticated;

REVOKE ALL ON FUNCTION moderate_tag(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION moderate_tag(bigint, text) TO authenticated;
