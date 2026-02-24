-- Materialise last_activity_at on profiles.
--
-- Previously get_inactive_members_since() recomputed last activity on every
-- load by aggregating across five tables.  This migration adds a denormalised
-- column kept current by AFTER INSERT triggers, making activity reads O(1).
-- Login is also promoted to a first-class activity signal.

-- ── 1. Add column ──────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- ── 2. Backfill from existing data ────────────────────────────────────────

UPDATE profiles p
SET last_activity_at = la.last_activity_at
FROM (
  SELECT profile_id, MAX(activity_at) AS last_activity_at
  FROM (
    SELECT author_id AS profile_id, MAX(created_at) AS activity_at
    FROM posts
    WHERE deleted_at IS NULL
    GROUP BY author_id

    UNION ALL

    SELECT author_id AS profile_id, MAX(created_at) AS activity_at
    FROM topics
    GROUP BY author_id

    UNION ALL

    SELECT profile_id, MAX(created_at) AS activity_at
    FROM post_likes
    GROUP BY profile_id

    UNION ALL

    SELECT profile_id, MAX(created_at) AS activity_at
    FROM quote_likes
    GROUP BY profile_id

    UNION ALL

    SELECT profile_id, MAX(last_seen_at) AS activity_at
    FROM profile_login_networks
    GROUP BY profile_id
  ) AS all_activity(profile_id, activity_at)
  GROUP BY profile_id
) la
WHERE p.id = la.profile_id;

-- ── 3. Trigger functions ───────────────────────────────────────────────────

-- For tables that identify the user via author_id (posts, topics).
CREATE OR REPLACE FUNCTION trg_set_last_activity_author()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.author_id;
  RETURN NULL;
END;
$$;

-- For tables that identify the user via profile_id (post_likes, quote_likes).
CREATE OR REPLACE FUNCTION trg_set_last_activity_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE profiles
  SET last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.profile_id;
  RETURN NULL;
END;
$$;

-- ── 4. AFTER INSERT triggers ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_posts_last_activity   ON posts;
DROP TRIGGER IF EXISTS trg_topics_last_activity  ON topics;
DROP TRIGGER IF EXISTS trg_plikes_last_activity  ON post_likes;
DROP TRIGGER IF EXISTS trg_qlikes_last_activity  ON quote_likes;

CREATE TRIGGER trg_posts_last_activity
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION trg_set_last_activity_author();

CREATE TRIGGER trg_topics_last_activity
  AFTER INSERT ON topics
  FOR EACH ROW EXECUTE FUNCTION trg_set_last_activity_author();

CREATE TRIGGER trg_plikes_last_activity
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION trg_set_last_activity_profile();

CREATE TRIGGER trg_qlikes_last_activity
  AFTER INSERT ON quote_likes
  FOR EACH ROW EXECUTE FUNCTION trg_set_last_activity_profile();

-- ── 5. Promote login to first-class activity signal ───────────────────────
-- Rebuild record_login_activity to also stamp last_activity_at.

DROP FUNCTION IF EXISTS record_login_activity(uuid, text);
CREATE OR REPLACE FUNCTION record_login_activity(
  target_user_id uuid,
  fingerprint text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_fingerprint text := NULLIF(trim(fingerprint), '');
  inserted_count integer := 0;
  next_login_count integer := 0;
  next_network_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE profiles
  SET
    login_count      = COALESCE(login_count, 0) + 1,
    last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), now())
  WHERE id = target_user_id
  RETURNING COALESCE(login_count, 0) INTO next_login_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF normalized_fingerprint IS NOT NULL THEN
    IF length(normalized_fingerprint) < 16 THEN
      RAISE EXCEPTION 'Invalid fingerprint';
    END IF;

    INSERT INTO profile_login_networks (profile_id, network_fingerprint, first_seen_at, last_seen_at, seen_count)
    VALUES (target_user_id, normalized_fingerprint, now(), now(), 1)
    ON CONFLICT (profile_id, network_fingerprint) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    IF inserted_count = 0 THEN
      UPDATE profile_login_networks
      SET
        last_seen_at = now(),
        seen_count   = seen_count + 1
      WHERE profile_id        = target_user_id
        AND network_fingerprint = normalized_fingerprint;
    END IF;

    UPDATE profiles
    SET login_network_count = (
      SELECT COUNT(*)::integer
      FROM profile_login_networks
      WHERE profile_id = target_user_id
    )
    WHERE id = target_user_id;
  END IF;

  SELECT COALESCE(login_network_count, 0)
  INTO next_network_count
  FROM profiles
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'login_count',      next_login_count,
    'login_network_count', next_network_count,
    'network_tracked',  normalized_fingerprint IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION record_login_activity(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_login_activity(uuid, text) TO authenticated;

-- ── 6. Simplify get_inactive_members_since ────────────────────────────────
-- Replace the expensive UNION ALL aggregation with a direct column read.

DROP FUNCTION IF EXISTS get_inactive_members_since();
CREATE OR REPLACE FUNCTION get_inactive_members_since()
RETURNS TABLE (
  id               uuid,
  username         text,
  profile_image_url text,
  created_at       timestamptz,
  is_admin         boolean,
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
  SELECT
    pr.id,
    pr.username,
    pr.profile_image_url,
    pr.created_at,
    pr.is_admin,
    pr.last_activity_at
  FROM profiles pr
  WHERE pr.approval_status = 'approved'
    AND pr.last_activity_at IS NULL
  ORDER BY pr.created_at ASC NULLS LAST, pr.legacy_forum_user_id ASC NULLS LAST, pr.username ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_inactive_members_since() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_inactive_members_since() TO authenticated;
