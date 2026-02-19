-- Tag groups can be used for search expansion, arrangement grouping, or both.

ALTER TABLE tag_groups
  ADD COLUMN IF NOT EXISTS group_kind text NOT NULL DEFAULT 'both';

ALTER TABLE tag_groups DROP CONSTRAINT IF EXISTS tag_groups_kind_valid;
ALTER TABLE tag_groups
  ADD CONSTRAINT tag_groups_kind_valid
  CHECK (group_kind IN ('search', 'arrangement', 'both'));

DROP FUNCTION IF EXISTS get_tag_groups_with_members();
CREATE OR REPLACE FUNCTION get_tag_groups_with_members()
RETURNS TABLE (
  group_id bigint,
  group_name text,
  group_slug text,
  description text,
  searchable boolean,
  group_kind text,
  member_count bigint,
  member_tag_ids bigint[],
  created_at timestamptz,
  updated_at timestamptz
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
    g.id,
    g.name,
    g.slug,
    g.description,
    g.searchable,
    g.group_kind,
    COUNT(m.tag_id)::bigint AS member_count,
    COALESCE(array_agg(m.tag_id ORDER BY m.tag_id) FILTER (WHERE m.tag_id IS NOT NULL), ARRAY[]::bigint[]) AS member_tag_ids,
    g.created_at,
    g.updated_at
  FROM tag_groups g
  LEFT JOIN tag_group_members m ON m.group_id = g.id
  GROUP BY g.id, g.name, g.slug, g.description, g.searchable, g.group_kind, g.created_at, g.updated_at
  ORDER BY g.name ASC;
END;
$$;

DROP FUNCTION IF EXISTS upsert_tag_group(bigint, text, text, text, boolean, bigint[]);
DROP FUNCTION IF EXISTS upsert_tag_group(bigint, text, text, text, boolean, bigint[], text);
CREATE OR REPLACE FUNCTION upsert_tag_group(
  input_group_id bigint DEFAULT NULL,
  input_name text DEFAULT NULL,
  input_slug text DEFAULT NULL,
  input_description text DEFAULT NULL,
  input_searchable boolean DEFAULT true,
  input_member_tag_ids bigint[] DEFAULT NULL,
  input_group_kind text DEFAULT 'both'
)
RETURNS TABLE (
  group_id bigint,
  group_name text,
  group_slug text,
  description text,
  searchable boolean,
  group_kind text,
  member_count bigint,
  member_tag_ids bigint[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  effective_group_id bigint;
  normalized_name text;
  normalized_slug text;
  normalized_group_kind text := lower(btrim(COALESCE(input_group_kind, 'both')));
  normalized_member_ids bigint[] := resolve_canonical_tag_ids(input_member_tag_ids);
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

  normalized_name := btrim(COALESCE(input_name, ''));
  IF char_length(normalized_name) = 0 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;
  IF char_length(normalized_name) > 64 THEN
    RAISE EXCEPTION 'Group name is too long';
  END IF;

  normalized_slug := lower(btrim(COALESCE(input_slug, '')));
  IF char_length(normalized_slug) = 0 THEN
    normalized_slug := slugify_tag_text(normalized_name);
  END IF;
  IF char_length(normalized_slug) = 0 THEN
    RAISE EXCEPTION 'Group slug is required';
  END IF;
  IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Group slug format is invalid';
  END IF;

  IF normalized_group_kind NOT IN ('search', 'arrangement', 'both') THEN
    RAISE EXCEPTION 'Group kind is invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tags t
    WHERE t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
      AND lower(btrim(t.name)) = lower(normalized_name)
  ) THEN
    RAISE EXCEPTION 'Group name cannot be the same as an existing tag name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tag_groups g
    WHERE lower(btrim(g.name)) = lower(normalized_name)
      AND (input_group_id IS NULL OR g.id <> input_group_id)
  ) THEN
    RAISE EXCEPTION 'Group name already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tag_groups g
    WHERE g.slug = normalized_slug
      AND (input_group_id IS NULL OR g.id <> input_group_id)
  ) THEN
    RAISE EXCEPTION 'Group slug already exists';
  END IF;

  IF input_group_id IS NULL THEN
    INSERT INTO tag_groups (name, slug, description, searchable, group_kind, created_by, updated_by)
    VALUES (
      normalized_name,
      normalized_slug,
      NULLIF(btrim(COALESCE(input_description, '')), ''),
      COALESCE(input_searchable, true),
      normalized_group_kind,
      auth.uid(),
      auth.uid()
    )
    RETURNING id INTO effective_group_id;
  ELSE
    UPDATE tag_groups
    SET name = normalized_name,
        slug = normalized_slug,
        description = NULLIF(btrim(COALESCE(input_description, '')), ''),
        searchable = COALESCE(input_searchable, true),
        group_kind = normalized_group_kind,
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = input_group_id
    RETURNING id INTO effective_group_id;

    IF effective_group_id IS NULL THEN
      RAISE EXCEPTION 'Tag group not found';
    END IF;
  END IF;

  DELETE FROM tag_group_members gm
  WHERE gm.group_id = effective_group_id;

  IF normalized_member_ids IS NOT NULL AND COALESCE(array_length(normalized_member_ids, 1), 0) > 0 THEN
    INSERT INTO tag_group_members (group_id, tag_id, created_by)
    SELECT DISTINCT effective_group_id, t.id, auth.uid()
    FROM tags t
    WHERE t.id = ANY(normalized_member_ids)
      AND t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.slug,
    g.description,
    g.searchable,
    g.group_kind,
    COUNT(m.tag_id)::bigint AS member_count,
    COALESCE(array_agg(m.tag_id ORDER BY m.tag_id) FILTER (WHERE m.tag_id IS NOT NULL), ARRAY[]::bigint[])
  FROM tag_groups g
  LEFT JOIN tag_group_members m ON m.group_id = g.id
  WHERE g.id = effective_group_id
  GROUP BY g.id, g.name, g.slug, g.description, g.searchable, g.group_kind;
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
    AND g.group_kind IN ('search', 'both')
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

REVOKE ALL ON FUNCTION get_tag_groups_with_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tag_groups_with_members() TO authenticated;

REVOKE ALL ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text) TO authenticated;

REVOKE ALL ON FUNCTION search_tag_groups(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_tag_groups(text, integer) TO authenticated;
