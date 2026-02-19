-- Fix "column reference tag_id is ambiguous" in tag-group membership writes.

DROP FUNCTION IF EXISTS upsert_tag_group(bigint, text, text, text, boolean, bigint[], text);
DROP FUNCTION IF EXISTS upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer);
CREATE OR REPLACE FUNCTION upsert_tag_group(
  input_group_id bigint DEFAULT NULL,
  input_name text DEFAULT NULL,
  input_slug text DEFAULT NULL,
  input_description text DEFAULT NULL,
  input_searchable boolean DEFAULT true,
  input_member_tag_ids bigint[] DEFAULT NULL,
  input_group_kind text DEFAULT 'both',
  input_arrangement_order integer DEFAULT NULL
)
RETURNS TABLE (
  group_id bigint,
  group_name text,
  group_slug text,
  description text,
  searchable boolean,
  group_kind text,
  arrangement_order integer,
  member_count bigint,
  member_tag_ids bigint[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  caller_is_admin boolean := false;
  effective_group_id bigint;
  normalized_name text;
  normalized_slug text;
  normalized_group_kind text := lower(btrim(COALESCE(input_group_kind, 'both')));
  normalized_arrangement_order integer;
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

  IF normalized_group_kind IN ('arrangement', 'both') THEN
    IF input_arrangement_order IS NULL THEN
      SELECT COALESCE(MAX(g.arrangement_order), 0) + 1
      INTO normalized_arrangement_order
      FROM tag_groups g
      WHERE g.group_kind IN ('arrangement', 'both')
        AND (input_group_id IS NULL OR g.id <> input_group_id);
    ELSE
      normalized_arrangement_order := GREATEST(input_arrangement_order, 0);
    END IF;
  ELSE
    normalized_arrangement_order := 0;
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
    INSERT INTO tag_groups (name, slug, description, searchable, group_kind, arrangement_order, created_by, updated_by)
    VALUES (
      normalized_name,
      normalized_slug,
      NULLIF(btrim(COALESCE(input_description, '')), ''),
      COALESCE(input_searchable, true),
      normalized_group_kind,
      normalized_arrangement_order,
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
        arrangement_order = normalized_arrangement_order,
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
    INSERT INTO tag_group_members (group_id, tag_id, sort_order, created_by)
    SELECT
      effective_group_id,
      t.id,
      desired.ordinality - 1,
      auth.uid()
    FROM (
      SELECT DISTINCT ON (u.member_tag_id)
        u.member_tag_id,
        u.ordinality
      FROM unnest(normalized_member_ids) WITH ORDINALITY AS u(member_tag_id, ordinality)
      WHERE u.member_tag_id IS NOT NULL
      ORDER BY u.member_tag_id, u.ordinality
    ) AS desired
    JOIN tags t ON t.id = desired.member_tag_id
    WHERE t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
    ORDER BY desired.ordinality ASC;
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.slug,
    g.description,
    g.searchable,
    g.group_kind,
    g.arrangement_order,
    COUNT(m.tag_id)::bigint AS member_count,
    COALESCE(
      array_agg(m.tag_id ORDER BY m.sort_order ASC, m.tag_id ASC)
      FILTER (WHERE m.tag_id IS NOT NULL),
      ARRAY[]::bigint[]
    )
  FROM tag_groups g
  LEFT JOIN tag_group_members m ON m.group_id = g.id
  WHERE g.id = effective_group_id
  GROUP BY g.id, g.name, g.slug, g.description, g.searchable, g.group_kind, g.arrangement_order;
END;
$$;

DROP FUNCTION IF EXISTS set_tag_group_memberships_for_tag(bigint, bigint[]);
CREATE OR REPLACE FUNCTION set_tag_group_memberships_for_tag(
  input_tag_id bigint,
  input_group_ids bigint[] DEFAULT NULL
)
RETURNS TABLE (
  tag_id bigint,
  group_ids bigint[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  caller_is_admin boolean := false;
  canonical_tag_id bigint;
  normalized_group_ids bigint[] := COALESCE(input_group_ids, ARRAY[]::bigint[]);
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

  SELECT resolve_canonical_tag_id(input_tag_id) INTO canonical_tag_id;
  IF canonical_tag_id IS NULL THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  IF canonical_tag_id <> input_tag_id THEN
    RAISE EXCEPTION 'Canonical tag required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tags t
    WHERE t.id = canonical_tag_id
      AND t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
  ) THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  DELETE FROM tag_group_members gm
  WHERE gm.tag_id = canonical_tag_id
    AND NOT (gm.group_id = ANY(normalized_group_ids));

  INSERT INTO tag_group_members (group_id, tag_id, sort_order, created_by)
  SELECT
    g.id,
    canonical_tag_id,
    COALESCE((
      SELECT MAX(existing.sort_order) + 1
      FROM tag_group_members existing
      WHERE existing.group_id = g.id
    ), 0),
    auth.uid()
  FROM tag_groups g
  WHERE g.id = ANY(normalized_group_ids)
  ON CONFLICT ON CONSTRAINT tag_group_members_pkey DO NOTHING;

  RETURN QUERY
  SELECT
    canonical_tag_id AS tag_id,
    COALESCE(array_agg(gm.group_id ORDER BY gm.group_id), ARRAY[]::bigint[]) AS group_ids
  FROM tag_group_members gm
  WHERE gm.tag_id = canonical_tag_id;
END;
$$;

REVOKE ALL ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer) TO authenticated;

REVOKE ALL ON FUNCTION set_tag_group_memberships_for_tag(bigint, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_tag_group_memberships_for_tag(bigint, bigint[]) TO authenticated;
