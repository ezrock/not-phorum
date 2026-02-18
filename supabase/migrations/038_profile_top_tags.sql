-- Top used tags per profile (based on topics authored by the profile).

DROP FUNCTION IF EXISTS get_profile_top_tags(uuid, int);
CREATE OR REPLACE FUNCTION get_profile_top_tags(
  target_profile_id uuid,
  result_limit int DEFAULT 5
)
RETURNS TABLE (
  tag_id bigint,
  tag_name text,
  tag_slug text,
  usage_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_limit int := GREATEST(COALESCE(result_limit, 5), 1);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Target profile id is required';
  END IF;

  RETURN QUERY
  WITH canonical_topic_tags AS (
    SELECT
      t.id AS topic_id,
      resolve_canonical_tag_id(tt.tag_id) AS canonical_tag_id
    FROM topics t
    JOIN topic_tags tt ON tt.topic_id = t.id
    WHERE t.author_id = target_profile_id
  )
  SELECT
    canonical.id AS tag_id,
    canonical.name AS tag_name,
    canonical.slug AS tag_slug,
    COUNT(DISTINCT ctt.topic_id)::bigint AS usage_count
  FROM canonical_topic_tags ctt
  JOIN tags canonical ON canonical.id = ctt.canonical_tag_id
  WHERE canonical.redirect_to_tag_id IS NULL
    AND canonical.status <> 'hidden'
  GROUP BY canonical.id, canonical.name, canonical.slug
  ORDER BY COUNT(DISTINCT ctt.topic_id) DESC, canonical.name ASC
  LIMIT normalized_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_profile_top_tags(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_profile_top_tags(uuid, int) TO authenticated;
