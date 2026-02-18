-- Admin slug editing for tags + tag groups for browsing/search.

DROP FUNCTION IF EXISTS slugify_tag_text(text);
CREATE OR REPLACE FUNCTION slugify_tag_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(
        regexp_replace(
          regexp_replace(btrim(COALESCE(input_text, '')), '[^a-zA-Z0-9\s-]', '', 'g'),
          '\s+', '-', 'g'
        )
      ),
      '-+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );
$$;

CREATE TABLE IF NOT EXISTS tag_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  searchable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT tag_groups_name_length CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 64),
  CONSTRAINT tag_groups_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS tag_group_members (
  group_id bigint NOT NULL REFERENCES tag_groups(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (group_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_groups_searchable_name
  ON tag_groups (searchable, name);

CREATE INDEX IF NOT EXISTS idx_tag_group_members_tag_id
  ON tag_group_members (tag_id);

ALTER TABLE tag_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_groups_select_authenticated" ON tag_groups;
CREATE POLICY "tag_groups_select_authenticated"
  ON tag_groups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tag_groups_admin_write" ON tag_groups;
CREATE POLICY "tag_groups_admin_write"
  ON tag_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );

DROP POLICY IF EXISTS "tag_group_members_select_authenticated" ON tag_group_members;
CREATE POLICY "tag_group_members_select_authenticated"
  ON tag_group_members
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tag_group_members_admin_write" ON tag_group_members;
CREATE POLICY "tag_group_members_admin_write"
  ON tag_group_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );

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
    IF normalize_tag_alias(current_row.name) <> normalize_tag_alias(updated_row.name) THEN
      INSERT INTO tag_aliases (tag_id, alias, normalized_alias, created_by)
      VALUES (updated_row.id, current_row.name, normalize_tag_alias(current_row.name), auth.uid())
      ON CONFLICT (normalized_alias) DO UPDATE
        SET tag_id = EXCLUDED.tag_id,
            alias = EXCLUDED.alias,
            created_by = EXCLUDED.created_by;
    END IF;

    IF normalize_tag_alias(current_row.slug) <> normalize_tag_alias(updated_row.slug) THEN
      INSERT INTO tag_aliases (tag_id, alias, normalized_alias, created_by)
      VALUES (updated_row.id, current_row.slug, normalize_tag_alias(current_row.slug), auth.uid())
      ON CONFLICT (normalized_alias) DO UPDATE
        SET tag_id = EXCLUDED.tag_id,
            alias = EXCLUDED.alias,
            created_by = EXCLUDED.created_by;
    END IF;
  END IF;

  RETURN updated_row;
END;
$$;

DROP FUNCTION IF EXISTS get_tag_groups_with_members();
CREATE OR REPLACE FUNCTION get_tag_groups_with_members()
RETURNS TABLE (
  group_id bigint,
  group_name text,
  group_slug text,
  description text,
  searchable boolean,
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
    COUNT(m.tag_id)::bigint AS member_count,
    COALESCE(array_agg(m.tag_id ORDER BY m.tag_id) FILTER (WHERE m.tag_id IS NOT NULL), ARRAY[]::bigint[]) AS member_tag_ids,
    g.created_at,
    g.updated_at
  FROM tag_groups g
  LEFT JOIN tag_group_members m ON m.group_id = g.id
  GROUP BY g.id, g.name, g.slug, g.description, g.searchable, g.created_at, g.updated_at
  ORDER BY g.name ASC;
END;
$$;

DROP FUNCTION IF EXISTS upsert_tag_group(bigint, text, text, text, boolean, bigint[]);
CREATE OR REPLACE FUNCTION upsert_tag_group(
  input_group_id bigint DEFAULT NULL,
  input_name text DEFAULT NULL,
  input_slug text DEFAULT NULL,
  input_description text DEFAULT NULL,
  input_searchable boolean DEFAULT true,
  input_member_tag_ids bigint[] DEFAULT NULL
)
RETURNS TABLE (
  group_id bigint,
  group_name text,
  group_slug text,
  description text,
  searchable boolean,
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

  IF input_group_id IS NULL THEN
    INSERT INTO tag_groups (name, slug, description, searchable, created_by, updated_by)
    VALUES (normalized_name, normalized_slug, NULLIF(btrim(COALESCE(input_description, '')), ''), COALESCE(input_searchable, true), auth.uid(), auth.uid())
    RETURNING id INTO effective_group_id;
  ELSE
    UPDATE tag_groups
    SET name = normalized_name,
        slug = normalized_slug,
        description = NULLIF(btrim(COALESCE(input_description, '')), ''),
        searchable = COALESCE(input_searchable, true),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = input_group_id
    RETURNING id INTO effective_group_id;

    IF effective_group_id IS NULL THEN
      RAISE EXCEPTION 'Tag group not found';
    END IF;
  END IF;

  DELETE FROM tag_group_members
  WHERE group_id = effective_group_id;

  IF normalized_member_ids IS NOT NULL AND COALESCE(array_length(normalized_member_ids, 1), 0) > 0 THEN
    INSERT INTO tag_group_members (group_id, tag_id, created_by)
    SELECT effective_group_id, t.id, auth.uid()
    FROM tags t
    WHERE t.id = ANY(normalized_member_ids)
      AND t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
    ON CONFLICT (group_id, tag_id) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.slug,
    g.description,
    g.searchable,
    COUNT(m.tag_id)::bigint AS member_count,
    COALESCE(array_agg(m.tag_id ORDER BY m.tag_id) FILTER (WHERE m.tag_id IS NOT NULL), ARRAY[]::bigint[])
  FROM tag_groups g
  LEFT JOIN tag_group_members m ON m.group_id = g.id
  WHERE g.id = effective_group_id
  GROUP BY g.id, g.name, g.slug, g.description, g.searchable;
END;
$$;

DROP FUNCTION IF EXISTS delete_tag_group(bigint);
CREATE OR REPLACE FUNCTION delete_tag_group(input_group_id bigint)
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

  DELETE FROM tag_groups
  WHERE id = input_group_id;
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
    )
  GROUP BY g.id, g.name, g.slug
  ORDER BY COUNT(m.tag_id) DESC, g.name ASC
  LIMIT normalized_limit;
END;
$$;

-- Keep merge logic aligned with tag aliases + group memberships.
CREATE OR REPLACE FUNCTION merge_tags(
  source_tag_id bigint,
  target_tag_id bigint
)
RETURNS tags
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  canonical_target_id bigint;
  source_row tags%ROWTYPE;
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

  IF source_tag_id IS NULL OR target_tag_id IS NULL THEN
    RAISE EXCEPTION 'Both source and target tag ids are required';
  END IF;

  canonical_target_id := resolve_canonical_tag_id(target_tag_id);
  IF canonical_target_id IS NULL THEN
    RAISE EXCEPTION 'Target tag not found';
  END IF;

  IF resolve_canonical_tag_id(source_tag_id) = canonical_target_id THEN
    RAISE EXCEPTION 'Source and target resolve to the same canonical tag';
  END IF;

  INSERT INTO topic_tags (topic_id, tag_id, created_at, created_by)
  SELECT tt.topic_id, canonical_target_id, tt.created_at, tt.created_by
  FROM topic_tags tt
  WHERE tt.tag_id = source_tag_id
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  DELETE FROM topic_tags
  WHERE tag_id = source_tag_id;

  INSERT INTO tag_group_members (group_id, tag_id, created_at, created_by)
  SELECT gm.group_id, canonical_target_id, gm.created_at, gm.created_by
  FROM tag_group_members gm
  WHERE gm.tag_id = source_tag_id
  ON CONFLICT (group_id, tag_id) DO NOTHING;

  DELETE FROM tag_group_members
  WHERE tag_id = source_tag_id;

  UPDATE tag_aliases
  SET tag_id = canonical_target_id
  WHERE tag_id = source_tag_id;

  UPDATE tags
  SET redirect_to_tag_id = canonical_target_id
  WHERE redirect_to_tag_id = source_tag_id;

  UPDATE tags
  SET status = 'hidden',
      featured = false,
      redirect_to_tag_id = canonical_target_id
  WHERE id = source_tag_id
  RETURNING * INTO source_row;

  IF source_row.id IS NULL THEN
    RAISE EXCEPTION 'Source tag not found';
  END IF;

  RETURN source_row;
END;
$$;

REVOKE ALL ON FUNCTION slugify_tag_text(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION slugify_tag_text(text) TO authenticated;

REVOKE ALL ON FUNCTION update_tag_details(bigint, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_tag_details(bigint, text, text, boolean) TO authenticated;

REVOKE ALL ON FUNCTION get_tag_groups_with_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tag_groups_with_members() TO authenticated;

REVOKE ALL ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_tag_group(bigint, text, text, text, boolean, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION delete_tag_group(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_tag_group(bigint) TO authenticated;

REVOKE ALL ON FUNCTION search_tag_groups(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_tag_groups(text, integer) TO authenticated;

REVOKE ALL ON FUNCTION merge_tags(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_tags(bigint, bigint) TO authenticated;
