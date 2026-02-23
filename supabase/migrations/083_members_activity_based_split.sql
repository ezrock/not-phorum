-- Replace time-based inactive detection with activity-based split.
--
-- Old logic: inactive = registered > N days ago AND no activity in last N days.
-- New logic: inactive = has NO activity at all on the new forum (posts, topics,
--            likes, quote likes, or login network records).
--
-- This gives a clean binary split:
--   active section   → has ever posted, liked, or logged in on the new forum
--   "Missä he ovat nyt?" → has never done any of those things
--
-- Inactive users are ordered by most days of inactivity first (created_at ASC),
-- with legacy_forum_user_id as tiebreaker for users who share the same timestamp
-- (the bulk 2005-07-05 migration cohort).

DROP FUNCTION IF EXISTS get_inactive_members_since(integer);
CREATE OR REPLACE FUNCTION get_inactive_members_since()
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
    AND la.last_activity_at IS NULL
  ORDER BY pr.created_at ASC NULLS LAST, pr.legacy_forum_user_id ASC NULLS LAST, pr.username ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_inactive_members_since() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_inactive_members_since() TO authenticated;
