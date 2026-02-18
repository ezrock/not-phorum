-- Admin helpers for deleting canonical tags safely.
-- Deletion is allowed only when tag is not used anywhere.

DROP FUNCTION IF EXISTS get_admin_canonical_tags_with_usage();
CREATE OR REPLACE FUNCTION get_admin_canonical_tags_with_usage()
RETURNS TABLE (
  id bigint,
  name text,
  slug text,
  usage_count bigint,
  alias_count bigint,
  group_membership_count bigint,
  redirect_reference_count bigint
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
    t.id,
    t.name,
    t.slug,
    COALESCE(tt_usage.cnt, 0) AS usage_count,
    COALESCE(ta_usage.cnt, 0) AS alias_count,
    COALESCE(tgm_usage.cnt, 0) AS group_membership_count,
    COALESCE(redirect_usage.cnt, 0) AS redirect_reference_count
  FROM tags t
  LEFT JOIN (
    SELECT tt.tag_id, COUNT(*)::bigint AS cnt
    FROM topic_tags tt
    GROUP BY tt.tag_id
  ) tt_usage ON tt_usage.tag_id = t.id
  LEFT JOIN (
    SELECT ta.tag_id, COUNT(*)::bigint AS cnt
    FROM tag_aliases ta
    GROUP BY ta.tag_id
  ) ta_usage ON ta_usage.tag_id = t.id
  LEFT JOIN (
    SELECT gm.tag_id, COUNT(*)::bigint AS cnt
    FROM tag_group_members gm
    GROUP BY gm.tag_id
  ) tgm_usage ON tgm_usage.tag_id = t.id
  LEFT JOIN (
    SELECT t2.redirect_to_tag_id AS tag_id, COUNT(*)::bigint AS cnt
    FROM tags t2
    WHERE t2.redirect_to_tag_id IS NOT NULL
    GROUP BY t2.redirect_to_tag_id
  ) redirect_usage ON redirect_usage.tag_id = t.id
  WHERE t.redirect_to_tag_id IS NULL
    AND t.status <> 'hidden'
  ORDER BY t.name ASC;
END;
$$;

DROP FUNCTION IF EXISTS delete_tag_if_unused(bigint);
CREATE OR REPLACE FUNCTION delete_tag_if_unused(input_tag_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
  canonical_tag_id bigint;
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
    RAISE EXCEPTION 'Delete canonical tag only';
  END IF;

  IF EXISTS (SELECT 1 FROM topic_tags tt WHERE tt.tag_id = canonical_tag_id LIMIT 1) THEN
    RAISE EXCEPTION 'Tag is in use by topics';
  END IF;

  IF EXISTS (SELECT 1 FROM tag_aliases ta WHERE ta.tag_id = canonical_tag_id LIMIT 1) THEN
    RAISE EXCEPTION 'Tag has aliases';
  END IF;

  IF EXISTS (SELECT 1 FROM tag_group_members gm WHERE gm.tag_id = canonical_tag_id LIMIT 1) THEN
    RAISE EXCEPTION 'Tag is in use by tag groups';
  END IF;

  IF EXISTS (SELECT 1 FROM tags t WHERE t.redirect_to_tag_id = canonical_tag_id LIMIT 1) THEN
    RAISE EXCEPTION 'Tag is referenced by merged aliases';
  END IF;

  DELETE FROM tags t
  WHERE t.id = canonical_tag_id
    AND t.redirect_to_tag_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tag not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION get_admin_canonical_tags_with_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_canonical_tags_with_usage() TO authenticated;

REVOKE ALL ON FUNCTION delete_tag_if_unused(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_tag_if_unused(bigint) TO authenticated;
