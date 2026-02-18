-- Allow admins to rename canonical tags from UI.

DROP FUNCTION IF EXISTS rename_tag(bigint, text);
CREATE OR REPLACE FUNCTION rename_tag(
  input_tag_id bigint,
  input_name text
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  effective_tag_id bigint;
  normalized_name text;
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

  normalized_name := btrim(COALESCE(input_name, ''));
  IF char_length(normalized_name) = 0 THEN
    RAISE EXCEPTION 'Tag name is required';
  END IF;

  IF char_length(normalized_name) > 64 THEN
    RAISE EXCEPTION 'Tag name is too long';
  END IF;

  SELECT resolve_canonical_tag_id(input_tag_id) INTO effective_tag_id;
  IF effective_tag_id IS NULL THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  UPDATE tags
  SET name = normalized_name
  WHERE id = effective_tag_id
    AND redirect_to_tag_id IS NULL
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Canonical tag not found';
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION rename_tag(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rename_tag(bigint, text) TO authenticated;
