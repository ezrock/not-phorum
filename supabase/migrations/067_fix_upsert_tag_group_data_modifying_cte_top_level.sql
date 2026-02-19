-- Fix: upsert_tag_group used data-modifying CTE inside a subquery wrapper,
-- which fails with: "WITH clause containing a data-modifying statement must be at the top level".
--
-- This migration keeps current validation/error behavior, but rewrites membership sync
-- to use top-level statements.

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
  effective_group_id bigint;
  normalized_name text;
  normalized_slug text;
  normalized_group_kind text := lower(btrim(COALESCE(input_group_kind, 'both')));
  normalized_arrangement_order integer;
  normalized_member_ids bigint[] := resolve_canonical_tag_ids(input_member_tag_ids);
BEGIN
  PERFORM assert_is_admin();

  normalized_name := btrim(COALESCE(input_name, ''));
  IF char_length(normalized_name) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän nimi on pakollinen', DETAIL = 'validation.group_name_required';
  END IF;
  IF char_length(normalized_name) > 64 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän nimi on liian pitkä', DETAIL = 'validation.group_name_too_long';
  END IF;

  normalized_slug := lower(btrim(COALESCE(input_slug, '')));
  IF char_length(normalized_slug) = 0 THEN
    normalized_slug := slugify_tag_text(normalized_name);
  END IF;
  IF char_length(normalized_slug) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän slug on pakollinen', DETAIL = 'validation.group_slug_required';
  END IF;
  IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän slugin muoto on virheellinen', DETAIL = 'validation.group_slug_invalid';
  END IF;

  IF normalized_group_kind NOT IN ('search', 'arrangement', 'both') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän käyttötapa on virheellinen', DETAIL = 'validation.group_kind_invalid';
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
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän nimi ei voi olla sama kuin olemassa olevan tagin nimi', DETAIL = 'conflict.tag_name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tag_groups g
    WHERE lower(btrim(g.name)) = lower(normalized_name)
      AND (input_group_id IS NULL OR g.id <> input_group_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän nimi on jo käytössä', DETAIL = 'conflict.group_name';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tag_groups g
    WHERE g.slug = normalized_slug
      AND (input_group_id IS NULL OR g.id <> input_group_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ryhmän slug on jo käytössä', DETAIL = 'conflict.group_slug';
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
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagiryhmää ei löytynyt', DETAIL = 'not_found.group';
    END IF;
  END IF;

  -- 1) Delete members not in desired set.
  WITH desired AS (
    SELECT
      u.member_tag_id,
      MIN(u.ordinality) AS ordinality
    FROM unnest(COALESCE(normalized_member_ids, ARRAY[]::bigint[])) WITH ORDINALITY AS u(member_tag_id, ordinality)
    WHERE u.member_tag_id IS NOT NULL
    GROUP BY u.member_tag_id
  ), desired_valid AS (
    SELECT
      d.member_tag_id AS tag_id,
      d.ordinality - 1 AS sort_order
    FROM desired d
    JOIN tags t ON t.id = d.member_tag_id
    WHERE t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
  )
  DELETE FROM tag_group_members gm
  WHERE gm.group_id = effective_group_id
    AND NOT EXISTS (
      SELECT 1 FROM desired_valid dv WHERE dv.tag_id = gm.tag_id
    );

  -- 2) Update sort_order for existing members.
  WITH desired AS (
    SELECT
      u.member_tag_id,
      MIN(u.ordinality) AS ordinality
    FROM unnest(COALESCE(normalized_member_ids, ARRAY[]::bigint[])) WITH ORDINALITY AS u(member_tag_id, ordinality)
    WHERE u.member_tag_id IS NOT NULL
    GROUP BY u.member_tag_id
  ), desired_valid AS (
    SELECT
      d.member_tag_id AS tag_id,
      d.ordinality - 1 AS sort_order
    FROM desired d
    JOIN tags t ON t.id = d.member_tag_id
    WHERE t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
  )
  UPDATE tag_group_members gm
  SET sort_order = dv.sort_order
  FROM desired_valid dv
  WHERE gm.group_id = effective_group_id
    AND gm.tag_id = dv.tag_id
    AND gm.sort_order <> dv.sort_order;

  -- 3) Insert missing members.
  WITH desired AS (
    SELECT
      u.member_tag_id,
      MIN(u.ordinality) AS ordinality
    FROM unnest(COALESCE(normalized_member_ids, ARRAY[]::bigint[])) WITH ORDINALITY AS u(member_tag_id, ordinality)
    WHERE u.member_tag_id IS NOT NULL
    GROUP BY u.member_tag_id
  ), desired_valid AS (
    SELECT
      d.member_tag_id AS tag_id,
      d.ordinality - 1 AS sort_order
    FROM desired d
    JOIN tags t ON t.id = d.member_tag_id
    WHERE t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
  )
  INSERT INTO tag_group_members (group_id, tag_id, sort_order, created_by)
  SELECT effective_group_id, dv.tag_id, dv.sort_order, auth.uid()
  FROM desired_valid dv
  WHERE NOT EXISTS (
    SELECT 1
    FROM tag_group_members gm
    WHERE gm.group_id = effective_group_id
      AND gm.tag_id = dv.tag_id
  );

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

REVOKE ALL ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer) TO authenticated;
