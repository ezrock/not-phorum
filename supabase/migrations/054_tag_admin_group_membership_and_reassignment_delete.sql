-- Tag admin helpers:
-- - Update group memberships for a canonical tag.
-- - Delete canonical tag and reassign topic usages to replacement/off-topic.

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

  INSERT INTO tag_group_members (group_id, tag_id, created_by)
  SELECT g.id, canonical_tag_id, auth.uid()
  FROM tag_groups g
  WHERE g.id = ANY(normalized_group_ids)
  ON CONFLICT (group_id, tag_id) DO NOTHING;

  RETURN QUERY
  SELECT
    canonical_tag_id AS tag_id,
    COALESCE(array_agg(gm.group_id ORDER BY gm.group_id), ARRAY[]::bigint[]) AS group_ids
  FROM tag_group_members gm
  WHERE gm.tag_id = canonical_tag_id;
END;
$$;

DROP FUNCTION IF EXISTS delete_tag_with_reassignment(bigint, bigint);
CREATE OR REPLACE FUNCTION delete_tag_with_reassignment(
  input_tag_id bigint,
  input_replacement_tag_id bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  source_tag_id bigint;
  replacement_tag_id bigint;
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

  SELECT resolve_canonical_tag_id(input_tag_id) INTO source_tag_id;
  IF source_tag_id IS NULL OR source_tag_id <> input_tag_id THEN
    RAISE EXCEPTION 'Canonical tag required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM tags t
    WHERE t.id = source_tag_id
      AND t.redirect_to_tag_id IS NULL
      AND t.status <> 'hidden'
  ) THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;

  IF input_replacement_tag_id IS NOT NULL THEN
    replacement_tag_id := resolve_canonical_tag_id(input_replacement_tag_id);
  END IF;

  IF replacement_tag_id IS NULL THEN
    SELECT resolve_canonical_tag_id(t.id)
    INTO replacement_tag_id
    FROM tags t
    WHERE t.slug = 'off-topic'
      AND t.status <> 'hidden'
      AND t.id <> source_tag_id
    ORDER BY t.id ASC
    LIMIT 1;
  END IF;

  IF replacement_tag_id IS NULL THEN
    RAISE EXCEPTION 'Replacement tag is required (off-topic not available)';
  END IF;

  IF replacement_tag_id = source_tag_id THEN
    RAISE EXCEPTION 'Replacement tag must be different';
  END IF;

  INSERT INTO topic_tags (topic_id, tag_id, created_at, created_by)
  SELECT tt.topic_id, replacement_tag_id, tt.created_at, tt.created_by
  FROM topic_tags tt
  WHERE tt.tag_id = source_tag_id
  ON CONFLICT (topic_id, tag_id) DO NOTHING;

  DELETE FROM topic_tags
  WHERE tag_id = source_tag_id;

  UPDATE tags
  SET redirect_to_tag_id = replacement_tag_id
  WHERE redirect_to_tag_id = source_tag_id;

  DELETE FROM tags
  WHERE id = source_tag_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_tag_group_memberships_for_tag(bigint, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_tag_group_memberships_for_tag(bigint, bigint[]) TO authenticated;

REVOKE ALL ON FUNCTION delete_tag_with_reassignment(bigint, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_tag_with_reassignment(bigint, bigint) TO authenticated;
