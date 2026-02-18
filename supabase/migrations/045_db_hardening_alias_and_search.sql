-- Hardening: align tag rename alias-conflict behavior + speed up alias/group search.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_tag_aliases_alias_trgm
  ON tag_aliases USING gin (alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tag_groups_name_trgm
  ON tag_groups USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tag_groups_slug_trgm
  ON tag_groups USING gin (slug gin_trgm_ops);

DROP FUNCTION IF EXISTS update_tag_details(bigint, text, text, boolean);
CREATE OR REPLACE FUNCTION update_tag_details(
  input_tag_id bigint,
  input_name text DEFAULT NULL,
  input_slug text DEFAULT NULL,
  input_add_old_aliases boolean DEFAULT true
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  effective_tag_id bigint;
  current_row tags%ROWTYPE;
  updated_row tags%ROWTYPE;
  normalized_name text;
  normalized_slug text;
  normalized_old_name text;
  normalized_old_slug text;
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

  SELECT resolve_canonical_tag_id(input_tag_id) INTO effective_tag_id;
  IF effective_tag_id IS NULL THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  SELECT * INTO current_row
  FROM tags t
  WHERE t.id = effective_tag_id
    AND t.redirect_to_tag_id IS NULL;

  IF current_row.id IS NULL THEN
    RAISE EXCEPTION 'Canonical tag not found';
  END IF;

  normalized_name := btrim(COALESCE(input_name, current_row.name));
  IF char_length(normalized_name) = 0 THEN
    RAISE EXCEPTION 'Tag name is required';
  END IF;
  IF char_length(normalized_name) > 64 THEN
    RAISE EXCEPTION 'Tag name is too long';
  END IF;

  normalized_slug := lower(btrim(COALESCE(input_slug, current_row.slug)));
  IF char_length(normalized_slug) = 0 THEN
    normalized_slug := slugify_tag_text(normalized_name);
  END IF;
  IF char_length(normalized_slug) = 0 THEN
    RAISE EXCEPTION 'Tag slug is required';
  END IF;
  IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Tag slug format is invalid';
  END IF;

  UPDATE tags
  SET name = normalized_name,
      slug = normalized_slug
  WHERE id = effective_tag_id
  RETURNING * INTO updated_row;

  IF updated_row.id IS NULL THEN
    RAISE EXCEPTION 'Tag update failed';
  END IF;

  IF COALESCE(input_add_old_aliases, true) THEN
    normalized_old_name := normalize_tag_alias(current_row.name);
    normalized_old_slug := normalize_tag_alias(current_row.slug);

    IF normalized_old_name <> normalize_tag_alias(updated_row.name) THEN
      -- Same message semantics as add_tag_alias: no silent alias reassignment.
      IF EXISTS (
        SELECT 1
        FROM tag_aliases ta
        WHERE ta.normalized_alias = normalized_old_name
          AND ta.tag_id <> updated_row.id
      ) THEN
        SELECT t.name
        INTO conflict_tag_name
        FROM tag_aliases ta
        JOIN tags t ON t.id = resolve_canonical_tag_id(ta.tag_id)
        WHERE ta.normalized_alias = normalized_old_name
        LIMIT 1;

        RAISE EXCEPTION 'alias on jo käytössä tagilla %', COALESCE(conflict_tag_name, 'tuntematon');
      END IF;

      INSERT INTO tag_aliases (tag_id, alias, normalized_alias, created_by)
      VALUES (updated_row.id, current_row.name, normalized_old_name, auth.uid())
      ON CONFLICT (normalized_alias) DO UPDATE
        SET alias = EXCLUDED.alias,
            created_by = EXCLUDED.created_by
      WHERE tag_aliases.tag_id = updated_row.id;
    END IF;

    IF normalized_old_slug <> normalize_tag_alias(updated_row.slug) THEN
      IF EXISTS (
        SELECT 1
        FROM tag_aliases ta
        WHERE ta.normalized_alias = normalized_old_slug
          AND ta.tag_id <> updated_row.id
      ) THEN
        SELECT t.name
        INTO conflict_tag_name
        FROM tag_aliases ta
        JOIN tags t ON t.id = resolve_canonical_tag_id(ta.tag_id)
        WHERE ta.normalized_alias = normalized_old_slug
        LIMIT 1;

        RAISE EXCEPTION 'alias on jo käytössä tagilla %', COALESCE(conflict_tag_name, 'tuntematon');
      END IF;

      INSERT INTO tag_aliases (tag_id, alias, normalized_alias, created_by)
      VALUES (updated_row.id, current_row.slug, normalized_old_slug, auth.uid())
      ON CONFLICT (normalized_alias) DO UPDATE
        SET alias = EXCLUDED.alias,
            created_by = EXCLUDED.created_by
      WHERE tag_aliases.tag_id = updated_row.id;
    END IF;
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION update_tag_details(bigint, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_tag_details(bigint, text, text, boolean) TO authenticated;
