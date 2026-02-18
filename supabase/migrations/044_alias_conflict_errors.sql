-- Alias conflict checks + explicit admin error messages.

DROP FUNCTION IF EXISTS add_tag_alias(bigint, text);
CREATE OR REPLACE FUNCTION add_tag_alias(
  input_tag_id bigint,
  input_alias text
)
RETURNS TABLE (
  alias_id bigint,
  tag_id bigint,
  tag_name text,
  tag_slug text,
  alias text,
  normalized_alias text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  effective_tag_id bigint;
  normalized text;
  existing_alias_id bigint;
  existing_alias_tag_id bigint;
  conflict_tag_id bigint;
  conflict_tag_name text;
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

  normalized := normalize_tag_alias(input_alias);
  IF char_length(normalized) = 0 THEN
    RAISE EXCEPTION 'Alias is required';
  END IF;

  SELECT resolve_canonical_tag_id(input_tag_id) INTO effective_tag_id;
  IF effective_tag_id IS NULL THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  -- Block aliases that collide with canonical tag names/slugs.
  SELECT t.id, t.name
  INTO conflict_tag_id, conflict_tag_name
  FROM tags t
  WHERE t.redirect_to_tag_id IS NULL
    AND t.status <> 'hidden'
    AND (lower(btrim(t.name)) = normalized OR lower(t.slug) = normalized)
  LIMIT 1;

  IF conflict_tag_id IS NOT NULL AND conflict_tag_id <> effective_tag_id THEN
    RAISE EXCEPTION 'alias on jo käytössä tagilla %', conflict_tag_name;
  END IF;

  IF conflict_tag_id = effective_tag_id THEN
    RAISE EXCEPTION 'Alias matches canonical tag name or slug';
  END IF;

  -- Explicit duplicate handling with a user-friendly message.
  SELECT ta.id, ta.tag_id
  INTO existing_alias_id, existing_alias_tag_id
  FROM tag_aliases ta
  WHERE ta.normalized_alias = normalized
  LIMIT 1;

  IF existing_alias_id IS NOT NULL THEN
    IF existing_alias_tag_id <> effective_tag_id THEN
      SELECT t.name
      INTO conflict_tag_name
      FROM tags t
      WHERE t.id = resolve_canonical_tag_id(existing_alias_tag_id)
      LIMIT 1;

      RAISE EXCEPTION 'alias on jo käytössä tagilla %', COALESCE(conflict_tag_name, existing_alias_tag_id::text);
    END IF;

    UPDATE tag_aliases
    SET alias = btrim(input_alias),
        created_by = auth.uid()
    WHERE id = existing_alias_id
    RETURNING
      tag_aliases.id,
      tag_aliases.tag_id,
      (SELECT t.name FROM tags t WHERE t.id = tag_aliases.tag_id),
      (SELECT t.slug FROM tags t WHERE t.id = tag_aliases.tag_id),
      tag_aliases.alias,
      tag_aliases.normalized_alias,
      tag_aliases.created_at
    INTO alias_id, tag_id, tag_name, tag_slug, alias, normalized_alias, created_at;

    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO tag_aliases (tag_id, alias, normalized_alias, created_by)
  VALUES (effective_tag_id, btrim(input_alias), normalized, auth.uid())
  RETURNING
    tag_aliases.id,
    tag_aliases.tag_id,
    (SELECT t.name FROM tags t WHERE t.id = tag_aliases.tag_id),
    (SELECT t.slug FROM tags t WHERE t.id = tag_aliases.tag_id),
    tag_aliases.alias,
    tag_aliases.normalized_alias,
    tag_aliases.created_at
  INTO alias_id, tag_id, tag_name, tag_slug, alias, normalized_alias, created_at;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION add_tag_alias(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_tag_alias(bigint, text) TO authenticated;
