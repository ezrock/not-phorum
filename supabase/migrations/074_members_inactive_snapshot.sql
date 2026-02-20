-- Members page helper: find approved users with no activity in the last N days.

DROP FUNCTION IF EXISTS get_inactive_members_since(integer);
CREATE OR REPLACE FUNCTION get_inactive_members_since(input_days integer DEFAULT 365)
RETURNS TABLE (
  id uuid,
  username text,
  profile_image_url text,
  created_at timestamptz,
  is_admin boolean,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_days integer := GREATEST(COALESCE(input_days, 365), 1);
  cutoff timestamptz := now() - make_interval(days => normalized_days);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH all_activity AS (
    SELECT p.author_id AS profile_id, MAX(p.created_at) AS activity_at
    FROM posts p
    WHERE p.deleted_at IS NULL
    GROUP BY p.author_id

    UNION ALL

    SELECT t.author_id AS profile_id, MAX(t.created_at) AS activity_at
    FROM topics t
    GROUP BY t.author_id

    UNION ALL

    SELECT pl.profile_id, MAX(pl.created_at) AS activity_at
    FROM post_likes pl
    GROUP BY pl.profile_id

    UNION ALL

    SELECT ql.profile_id, MAX(ql.created_at) AS activity_at
    FROM quote_likes ql
    GROUP BY ql.profile_id

    UNION ALL

    SELECT pln.profile_id, MAX(pln.last_seen_at) AS activity_at
    FROM profile_login_networks pln
    GROUP BY pln.profile_id
  ),
  last_activity AS (
    SELECT aa.profile_id, MAX(aa.activity_at) AS last_activity_at
    FROM all_activity aa
    GROUP BY aa.profile_id
  )
  SELECT
    pr.id,
    pr.username,
    pr.profile_image_url,
    pr.created_at,
    pr.is_admin,
    la.last_activity_at
  FROM profiles pr
  LEFT JOIN last_activity la ON la.profile_id = pr.id
  WHERE pr.approval_status = 'approved'
    AND pr.created_at <= cutoff
    AND (la.last_activity_at IS NULL OR la.last_activity_at < cutoff)
  ORDER BY COALESCE(la.last_activity_at, pr.created_at) ASC, pr.username ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_inactive_members_since(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_inactive_members_since(integer) TO authenticated;
