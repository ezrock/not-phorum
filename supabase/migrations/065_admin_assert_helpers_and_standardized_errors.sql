-- Quality + security hardening:
-- 1) shared auth/admin assertion helpers
-- 2) standardized user-facing exceptions with ERRCODE+DETAIL

DROP FUNCTION IF EXISTS assert_authenticated();
CREATE OR REPLACE FUNCTION assert_authenticated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Et ole kirjautunut',
      DETAIL = 'not_authenticated';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS assert_is_admin();
CREATE OR REPLACE FUNCTION assert_is_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_authenticated();

  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND COALESCE(p.is_admin, false) = true
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Ei oikeuksia',
      DETAIL = 'admin_required';
  END IF;
END;
$$;

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
  effective_tag_id bigint;
  normalized text;
  existing_alias_id bigint;
  existing_alias_tag_id bigint;
  conflict_tag_id bigint;
  conflict_tag_name text;
  conflict_group_name text;
BEGIN
  PERFORM assert_is_admin();

  IF input_tag_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagin id on pakollinen', DETAIL = 'validation.tag_id_required';
  END IF;

  normalized := normalize_tag_alias(input_alias);
  IF char_length(normalized) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Alias on pakollinen', DETAIL = 'validation.alias_required';
  END IF;

  SELECT resolve_canonical_tag_id(input_tag_id) INTO effective_tag_id;
  IF effective_tag_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagia ei löytynyt', DETAIL = 'not_found.tag';
  END IF;

  SELECT t.id, t.name
  INTO conflict_tag_id, conflict_tag_name
  FROM tags t
  WHERE t.redirect_to_tag_id IS NULL
    AND t.status <> 'hidden'
    AND (lower(btrim(t.name)) = normalized OR lower(t.slug) = normalized)
  LIMIT 1;

  IF conflict_tag_id IS NOT NULL AND conflict_tag_id <> effective_tag_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('alias on jo käytössä tagilla %s', conflict_tag_name), DETAIL = 'conflict.tag_name_or_slug';
  END IF;

  IF conflict_tag_id = effective_tag_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Alias on sama kuin tagin nimi tai slug', DETAIL = 'conflict.same_as_tag_name_or_slug';
  END IF;

  SELECT g.name
  INTO conflict_group_name
  FROM tag_groups g
  WHERE lower(btrim(g.name)) = normalized
     OR lower(g.slug) = normalized
  LIMIT 1;

  IF conflict_group_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('alias on jo käytössä tagiryhmällä %s', conflict_group_name), DETAIL = 'conflict.group_name_or_slug';
  END IF;

  SELECT g.name
  INTO conflict_group_name
  FROM tag_group_aliases a
  JOIN tag_groups g ON g.id = a.group_id
  WHERE a.normalized_alias = normalized
  LIMIT 1;

  IF conflict_group_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('alias on jo käytössä tagiryhmällä %s', conflict_group_name), DETAIL = 'conflict.group_alias';
  END IF;

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

      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = format('alias on jo käytössä tagilla %s', COALESCE(conflict_tag_name, existing_alias_tag_id::text)),
        DETAIL = 'conflict.tag_alias';
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
  normalized_name text := btrim(COALESCE(input_name, ''));
  normalized_slug text := lower(btrim(COALESCE(input_slug, '')));
  normalized_name_alias text;
  created_row tags%ROWTYPE;
  conflict_name text;
BEGIN
  PERFORM assert_is_admin();

  IF char_length(normalized_name) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagin nimi on pakollinen', DETAIL = 'validation.tag_name_required';
  END IF;

  IF char_length(normalized_name) > 64 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagin nimi on liian pitkä', DETAIL = 'validation.tag_name_too_long';
  END IF;

  IF char_length(normalized_slug) = 0 THEN
    normalized_slug := slugify_tag_text(normalized_name);
  END IF;

  IF char_length(normalized_slug) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagin slug on pakollinen', DETAIL = 'validation.tag_slug_required';
  END IF;

  IF normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagin slugin muoto on virheellinen', DETAIL = 'validation.tag_slug_invalid';
  END IF;

  normalized_name_alias := normalize_tag_alias(normalized_name);

  SELECT t.name INTO conflict_name
  FROM tags t
  WHERE lower(btrim(t.name)) = lower(normalized_name)
  LIMIT 1;
  IF conflict_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Tagin nimi on jo käytössä: %s', conflict_name), DETAIL = 'conflict.tag_name';
  END IF;

  SELECT t.name INTO conflict_name
  FROM tags t
  WHERE t.slug = normalized_slug
  LIMIT 1;
  IF conflict_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Tagin slug on jo käytössä: %s', normalized_slug), DETAIL = 'conflict.tag_slug';
  END IF;

  SELECT g.name INTO conflict_name
  FROM tag_groups g
  WHERE lower(btrim(g.name)) = lower(normalized_name)
     OR g.slug = normalized_slug
  LIMIT 1;
  IF conflict_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Tagin nimi tai slug on jo käytössä tagiryhmällä %s', conflict_name), DETAIL = 'conflict.group_name_or_slug';
  END IF;

  SELECT t.name INTO conflict_name
  FROM tag_aliases ta
  JOIN tags t ON t.id = resolve_canonical_tag_id(ta.tag_id)
  WHERE ta.normalized_alias IN (normalized_name_alias, normalized_slug)
  LIMIT 1;
  IF conflict_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Tagin nimi tai slug on jo käytössä tagialiaksena tagille %s', conflict_name), DETAIL = 'conflict.tag_alias';
  END IF;

  SELECT g.name INTO conflict_name
  FROM tag_group_aliases a
  JOIN tag_groups g ON g.id = a.group_id
  WHERE a.normalized_alias IN (normalized_name_alias, normalized_slug)
  LIMIT 1;
  IF conflict_name IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('Tagin nimi tai slug on jo käytössä ryhmäaliaksena ryhmälle %s', conflict_name), DETAIL = 'conflict.group_alias';
  END IF;

  BEGIN
    INSERT INTO tags (name, slug, status, featured, redirect_to_tag_id)
    VALUES (normalized_name, normalized_slug, 'approved', false, NULL)
    RETURNING * INTO created_row;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Tagin luonti epäonnistui: nimi tai slug on jo käytössä', DETAIL = 'conflict.unique_violation';
  END;

  RETURN created_row;
END;
$$;

DROP FUNCTION IF EXISTS swap_tag_group_arrangement_order(bigint, bigint);
CREATE OR REPLACE FUNCTION swap_tag_group_arrangement_order(
  input_first_group_id bigint,
  input_second_group_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  first_order integer;
  second_order integer;
BEGIN
  PERFORM assert_is_admin();

  IF input_first_group_id IS NULL OR input_second_group_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Molemmat ryhmä-id:t ovat pakollisia', DETAIL = 'validation.group_ids_required';
  END IF;

  IF input_first_group_id = input_second_group_id THEN
    RETURN;
  END IF;

  SELECT g.arrangement_order
  INTO first_order
  FROM tag_groups g
  WHERE g.id = input_first_group_id
    AND g.group_kind IN ('arrangement', 'both');

  IF first_order IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Ensimmäistä järjestelyryhmää ei löytynyt', DETAIL = 'not_found.first_arrangement_group';
  END IF;

  SELECT g.arrangement_order
  INTO second_order
  FROM tag_groups g
  WHERE g.id = input_second_group_id
    AND g.group_kind IN ('arrangement', 'both');

  IF second_order IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Toista järjestelyryhmää ei löytynyt', DETAIL = 'not_found.second_arrangement_group';
  END IF;

  UPDATE tag_groups
  SET arrangement_order = CASE
    WHEN id = input_first_group_id THEN second_order
    WHEN id = input_second_group_id THEN first_order
    ELSE arrangement_order
  END,
  updated_at = now(),
  updated_by = auth.uid()
  WHERE id IN (input_first_group_id, input_second_group_id);
END;
$$;

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

  PERFORM 1
  FROM (
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
    ), deleted AS (
      DELETE FROM tag_group_members gm
      WHERE gm.group_id = effective_group_id
        AND NOT EXISTS (
          SELECT 1 FROM desired_valid dv WHERE dv.tag_id = gm.tag_id
        )
      RETURNING 1
    ), updated AS (
      UPDATE tag_group_members gm
      SET sort_order = dv.sort_order
      FROM desired_valid dv
      WHERE gm.group_id = effective_group_id
        AND gm.tag_id = dv.tag_id
        AND gm.sort_order <> dv.sort_order
      RETURNING 1
    ), inserted AS (
      INSERT INTO tag_group_members (group_id, tag_id, sort_order, created_by)
      SELECT effective_group_id, dv.tag_id, dv.sort_order, auth.uid()
      FROM desired_valid dv
      WHERE NOT EXISTS (
        SELECT 1
        FROM tag_group_members gm
        WHERE gm.group_id = effective_group_id
          AND gm.tag_id = dv.tag_id
      )
      RETURNING 1
    )
    SELECT 1
  ) AS write_ops;

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

REVOKE ALL ON FUNCTION assert_authenticated() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_authenticated() TO authenticated;

REVOKE ALL ON FUNCTION assert_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assert_is_admin() TO authenticated;

REVOKE ALL ON FUNCTION add_tag_alias(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_tag_alias(bigint, text) TO authenticated;

REVOKE ALL ON FUNCTION create_admin_tag(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_admin_tag(text, text) TO authenticated;

REVOKE ALL ON FUNCTION swap_tag_group_arrangement_order(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION swap_tag_group_arrangement_order(bigint, bigint) TO authenticated;

REVOKE ALL ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[], text, integer) TO authenticated;
