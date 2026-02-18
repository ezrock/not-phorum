-- Tag aliases (synonyms/nicknames) + admin management RPCs.

CREATE TABLE IF NOT EXISTS tag_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE tag_aliases DROP CONSTRAINT IF EXISTS tag_aliases_alias_length;
ALTER TABLE tag_aliases
  ADD CONSTRAINT tag_aliases_alias_length
  CHECK (char_length(btrim(alias)) >= 1 AND char_length(btrim(alias)) <= 64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_aliases_normalized_unique
  ON tag_aliases (normalized_alias);

CREATE INDEX IF NOT EXISTS idx_tag_aliases_tag_id
  ON tag_aliases (tag_id);

CREATE INDEX IF NOT EXISTS idx_tag_aliases_tag_id_created_at
  ON tag_aliases (tag_id, created_at DESC);

ALTER TABLE tag_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_aliases_select_authenticated" ON tag_aliases;
CREATE POLICY "tag_aliases_select_authenticated"
  ON tag_aliases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tag_aliases_insert_admin_only" ON tag_aliases;
CREATE POLICY "tag_aliases_insert_admin_only"
  ON tag_aliases
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

DROP POLICY IF EXISTS "tag_aliases_delete_admin_only" ON tag_aliases;
CREATE POLICY "tag_aliases_delete_admin_only"
  ON tag_aliases
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

DROP FUNCTION IF EXISTS normalize_tag_alias(text);
CREATE OR REPLACE FUNCTION normalize_tag_alias(input_alias text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(input_alias, '')), '\s+', ' ', 'g'));
$$;

DROP FUNCTION IF EXISTS get_tag_aliases();
CREATE OR REPLACE FUNCTION get_tag_aliases()
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
    ta.id AS alias_id,
    t.id AS tag_id,
    t.name AS tag_name,
    t.slug AS tag_slug,
    ta.alias,
    ta.normalized_alias,
    ta.created_at
  FROM tag_aliases ta
  JOIN tags t ON t.id = ta.tag_id
  WHERE t.redirect_to_tag_id IS NULL
    AND t.status <> 'hidden'
  ORDER BY t.name ASC, ta.alias ASC;
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
  caller_is_admin boolean := false;
  effective_tag_id bigint;
  normalized text;
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

  IF EXISTS (
    SELECT 1
    FROM tags t
    WHERE t.id = effective_tag_id
      AND (lower(btrim(t.name)) = normalized OR lower(t.slug) = normalized)
  ) THEN
    RAISE EXCEPTION 'Alias matches canonical tag name or slug';
  END IF;

  INSERT INTO tag_aliases (tag_id, alias, normalized_alias, created_by)
  VALUES (effective_tag_id, btrim(input_alias), normalized, auth.uid())
  ON CONFLICT (normalized_alias) DO UPDATE
    SET tag_id = EXCLUDED.tag_id,
        alias = EXCLUDED.alias,
        created_by = EXCLUDED.created_by
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

DROP FUNCTION IF EXISTS delete_tag_alias(bigint);
CREATE OR REPLACE FUNCTION delete_tag_alias(input_alias_id bigint)
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

  DELETE FROM tag_aliases
  WHERE id = input_alias_id;
END;
$$;

REVOKE ALL ON FUNCTION normalize_tag_alias(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION normalize_tag_alias(text) TO authenticated;

REVOKE ALL ON FUNCTION get_tag_aliases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_tag_aliases() TO authenticated;

REVOKE ALL ON FUNCTION add_tag_alias(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_tag_alias(bigint, text) TO authenticated;

REVOKE ALL ON FUNCTION delete_tag_alias(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_tag_alias(bigint) TO authenticated;

-- Keep merge logic aligned with alias table: move aliases to canonical target.
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

REVOKE ALL ON FUNCTION merge_tags(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_tags(bigint, bigint) TO authenticated;
