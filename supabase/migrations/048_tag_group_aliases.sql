-- Tag group aliases (synonyms) + admin RPCs + search support.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS tag_group_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE tag_group_aliases DROP CONSTRAINT IF EXISTS tag_group_aliases_alias_length;
ALTER TABLE tag_group_aliases
  ADD CONSTRAINT tag_group_aliases_alias_length
  CHECK (char_length(btrim(alias)) >= 1 AND char_length(btrim(alias)) <= 64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_group_aliases_normalized_unique
  ON tag_group_aliases (normalized_alias);

CREATE INDEX IF NOT EXISTS idx_tag_group_aliases_group_id
  ON tag_group_aliases (group_id);

CREATE INDEX IF NOT EXISTS idx_tag_group_aliases_alias_trgm
  ON tag_group_aliases USING gin (alias gin_trgm_ops);

ALTER TABLE tag_group_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_group_aliases_select_authenticated" ON tag_group_aliases;
CREATE POLICY "tag_group_aliases_select_authenticated"
  ON tag_group_aliases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tag_group_aliases_insert_admin_only" ON tag_group_aliases;
CREATE POLICY "tag_group_aliases_insert_admin_only"
  ON tag_group_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );

DROP POLICY IF EXISTS "tag_group_aliases_delete_admin_only" ON tag_group_aliases;
CREATE POLICY "tag_group_aliases_delete_admin_only"
  ON tag_group_aliases
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );

DROP FUNCTION IF EXISTS get_tag_group_aliases();
CREATE OR REPLACE FUNCTION get_tag_group_aliases()
RETURNS TABLE (
  alias_id bigint,
  group_id bigint,
  group_name text,
  group_slug text,
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
    a.id AS alias_id,
    g.id AS group_id,
    g.name AS group_name,
    g.slug AS group_slug,
    a.alias,
    a.normalized_alias,
    a.created_at
  FROM tag_group_aliases a
  JOIN tag_groups g ON g.id = a.group_id
  ORDER BY g.name ASC, a.alias ASC;
END;
$$;

DROP FUNCTION IF EXISTS add_tag_group_alias(bigint, text);
CREATE OR REPLACE FUNCTION add_tag_group_alias(
  input_group_id bigint,
  input_alias text
)
RETURNS TABLE (
  alias_id bigint,
  group_id bigint,
  group_name text,
  group_slug text,
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
  normalized text;
  effective_group_id bigint;
  existing_alias_id bigint;
  existing_alias_group_id bigint;
  conflict_group_name text;
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

  IF input_group_id IS NULL THEN
    RAISE EXCEPTION 'Group id is required';
  END IF;

  SELECT g.id INTO effective_group_id
  FROM tag_groups g
  WHERE g.id = input_group_id;

  IF effective_group_id IS NULL THEN
    RAISE EXCEPTION 'Tag group not found';
  END IF;

  normalized := normalize_tag_alias(input_alias);
  IF char_length(normalized) = 0 THEN
    RAISE EXCEPTION 'Alias is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tag_groups g
    WHERE g.id = effective_group_id
      AND (lower(btrim(g.name)) = normalized OR lower(g.slug) = normalized)
  ) THEN
    RAISE EXCEPTION 'Alias matches group name or slug';
  END IF;

  -- Alias must not collide with canonical tag names/slugs.
  SELECT t.name
  INTO conflict_tag_name
  FROM tags t
  WHERE t.redirect_to_tag_id IS NULL
    AND t.status <> 'hidden'
    AND (lower(btrim(t.name)) = normalized OR lower(t.slug) = normalized)
  LIMIT 1;

  IF conflict_tag_name IS NOT NULL THEN
    RAISE EXCEPTION 'Alias already used by tag %', conflict_tag_name;
  END IF;

  -- Alias must not collide with canonical tag aliases.
  SELECT t.name
  INTO conflict_tag_name
  FROM tag_aliases ta
  JOIN tags t ON t.id = resolve_canonical_tag_id(ta.tag_id)
  WHERE ta.normalized_alias = normalized
  LIMIT 1;

  IF conflict_tag_name IS NOT NULL THEN
    RAISE EXCEPTION 'Alias already used by tag %', conflict_tag_name;
  END IF;

  -- Alias must not collide with any other tag group name/slug.
  SELECT g.name
  INTO conflict_group_name
  FROM tag_groups g
  WHERE (lower(btrim(g.name)) = normalized OR lower(g.slug) = normalized)
    AND g.id <> effective_group_id
  LIMIT 1;

  IF conflict_group_name IS NOT NULL THEN
    RAISE EXCEPTION 'Alias already used by group %', conflict_group_name;
  END IF;

  SELECT a.id, a.group_id
  INTO existing_alias_id, existing_alias_group_id
  FROM tag_group_aliases a
  WHERE a.normalized_alias = normalized
  LIMIT 1;

  IF existing_alias_id IS NOT NULL AND existing_alias_group_id <> effective_group_id THEN
    SELECT g.name INTO conflict_group_name
    FROM tag_groups g
    WHERE g.id = existing_alias_group_id
    LIMIT 1;
    RAISE EXCEPTION 'Alias already used by group %', COALESCE(conflict_group_name, existing_alias_group_id::text);
  END IF;

  IF existing_alias_id IS NOT NULL THEN
    UPDATE tag_group_aliases
    SET alias = btrim(input_alias),
        created_by = auth.uid()
    WHERE id = existing_alias_id
    RETURNING
      tag_group_aliases.id,
      tag_group_aliases.group_id,
      (SELECT g.name FROM tag_groups g WHERE g.id = tag_group_aliases.group_id),
      (SELECT g.slug FROM tag_groups g WHERE g.id = tag_group_aliases.group_id),
      tag_group_aliases.alias,
      tag_group_aliases.normalized_alias,
      tag_group_aliases.created_at
    INTO alias_id, group_id, group_name, group_slug, alias, normalized_alias, created_at;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO tag_group_aliases (group_id, alias, normalized_alias, created_by)
  VALUES (effective_group_id, btrim(input_alias), normalized, auth.uid())
  RETURNING
    tag_group_aliases.id,
    tag_group_aliases.group_id,
    (SELECT g.name FROM tag_groups g WHERE g.id = tag_group_aliases.group_id),
    (SELECT g.slug FROM tag_groups g WHERE g.id = tag_group_aliases.group_id),
    tag_group_aliases.alias,
    tag_group_aliases.normalized_alias,
    tag_group_aliases.created_at
  INTO alias_id, group_id, group_name, group_slug, alias, normalized_alias, created_at;

  RETURN NEXT;
END;
$$;

DROP FUNCTION IF EXISTS delete_tag_group_alias(bigint);
CREATE OR REPLACE FUNCTION delete_tag_group_alias(input_alias_id bigint)
RETURNS void
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

  DELETE FROM tag_group_aliases
  WHERE id = input_alias_id;
END;
$$;

DROP FUNCTION IF EXISTS search_tag_groups(text, integer);
CREATE OR REPLACE FUNCTION search_tag_groups(
  input_query text,
  input_limit integer DEFAULT 6
)
RETURNS TABLE (
  group_id bigint,
  group_name text,
  group_slug text,
  member_count bigint,
  member_tag_ids bigint[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_query text := btrim(COALESCE(input_query, ''));
  normalized_limit integer := GREATEST(COALESCE(input_limit, 6), 1);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF char_length(normalized_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.slug,
    COUNT(m.tag_id)::bigint AS member_count,
    COALESCE(array_agg(m.tag_id ORDER BY m.tag_id) FILTER (WHERE m.tag_id IS NOT NULL), ARRAY[]::bigint[]) AS member_tag_ids
  FROM tag_groups g
  LEFT JOIN tag_group_members m ON m.group_id = g.id
  WHERE g.searchable = true
    AND (
      g.name ILIKE '%' || normalized_query || '%'
      OR g.slug ILIKE '%' || normalized_query || '%'
      OR EXISTS (
        SELECT 1
        FROM tag_group_aliases a
        WHERE a.group_id = g.id
          AND a.alias ILIKE '%' || normalized_query || '%'
      )
    )
  GROUP BY g.id, g.name, g.slug
  ORDER BY COUNT(m.tag_id) DESC, g.name ASC
  LIMIT normalized_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_tag_group_aliases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tag_group_aliases() TO authenticated;

REVOKE ALL ON FUNCTION add_tag_group_alias(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_tag_group_alias(bigint, text) TO authenticated;

REVOKE ALL ON FUNCTION delete_tag_group_alias(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_tag_group_alias(bigint) TO authenticated;

REVOKE ALL ON FUNCTION search_tag_groups(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_tag_groups(text, integer) TO authenticated;
