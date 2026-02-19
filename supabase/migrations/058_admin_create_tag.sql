-- Admin RPC for creating canonical tags from UI.

DROP FUNCTION IF EXISTS create_admin_tag(text, text);
CREATE OR REPLACE FUNCTION create_admin_tag(
  input_name text,
  input_slug text DEFAULT NULL
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  normalized_name text := btrim(COALESCE(input_name, ''));
  normalized_slug text := lower(btrim(COALESCE(input_slug, '')));
  created_row tags%ROWTYPE;
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

  IF char_length(normalized_name) = 0 THEN
    RAISE EXCEPTION 'Tag name is required';
  END IF;

  IF char_length(normalized_name) > 64 THEN
    RAISE EXCEPTION 'Tag name is too long';
  END IF;

  IF char_length(normalized_slug) = 0 THEN
    normalized_slug := slugify_tag_text(normalized_name);
  END IF;

  IF char_length(normalized_slug) = 0 THEN
    RAISE EXCEPTION 'Tag slug is required';
  END IF;

  IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Tag slug format is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tags t
    WHERE lower(btrim(t.name)) = lower(normalized_name)
  ) THEN
    RAISE EXCEPTION 'Tag name already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tags t
    WHERE t.slug = normalized_slug
  ) THEN
    RAISE EXCEPTION 'Tag slug already exists';
  END IF;

  INSERT INTO tags (name, slug, status, featured, redirect_to_tag_id)
  VALUES (normalized_name, normalized_slug, 'approved', false, NULL)
  RETURNING * INTO created_row;

  RETURN created_row;
END;
$$;

REVOKE ALL ON FUNCTION create_admin_tag(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_admin_tag(text, text) TO authenticated;
