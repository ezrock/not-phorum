-- Legacy honour points import.
--
-- In the legacy forum: exp = posts + honour_points, level = FLOOR(SQRT(exp)).
-- When legacy posts are imported later, post_xp will reconstruct that side
-- automatically.  This migration preserves the manually-awarded honour_points
-- (trophies, event participation, admin bonuses) so legacy levels survive intact.
--
-- The 22 non-zero values below are extracted from phorum_users.user_data
-- (PHP-serialised cute_user_ranks.honour_points) cross-referenced against
-- legacy_forum_user_id (which equals phorum_users.user_id for all users ≤ id 44).

-- ── 1. Add column ─────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS legacy_honour_points integer NOT NULL DEFAULT 0
  CHECK (legacy_honour_points >= 0);

-- ── 2. Add XP source ──────────────────────────────────────────────────────

INSERT INTO xp_source_weights (source_key, label, weight, enabled) VALUES
  ('honour_bonus', 'Kunniapisteytys', 1.0, true)
ON CONFLICT (source_key) DO NOTHING;

-- ── 3. Apply extracted values ─────────────────────────────────────────────
-- Only writes rows where the column is still 0 (idempotent re-runs safe).

UPDATE profiles
SET legacy_honour_points = v.hp
FROM (VALUES
  -- legacy_forum_user_id, honour_points
  ( 2,  810),  -- pikemon
  ( 4,  190),  -- subjik
  ( 6,  270),  -- e-z
  ( 7,   20),  -- sampster
  ( 9,   80),  -- x-tend
  (10,   60),  -- jones
  (11,  130),  -- marqs
  (12,  140),  -- kataja
  (13,   40),  -- killatorspo
  (14,   60),  -- WillSmith
  (15,   40),  -- Ante
  (18,   40),  -- lemody
  (21,   90),  -- miggo
  (22,   20),  -- alex
  (23,   50),  -- tontsa
  (24,  100),  -- jaxen
  (25,   20),  -- 744-V3771
  (26,  140),  -- masmad
  (27,  150),  -- xjanix
  (28,   20),  -- Antti P.
  (29,   80),  -- laurimau
  (30,   10)   -- fonola
) AS v(legacy_user_id, hp)
WHERE profiles.legacy_forum_user_id = v.legacy_user_id
  AND profiles.legacy_honour_points = 0;

-- ── 4. Replace get_admin_levels_overview with honour_bonus included ───────

DROP FUNCTION IF EXISTS get_admin_levels_overview();
CREATE OR REPLACE FUNCTION get_admin_levels_overview()
RETURNS TABLE (
  profile_id     uuid,
  username       text,
  display_name   text,
  post_count     bigint,
  topic_count    bigint,
  like_count     bigint,
  trophy_points  bigint,
  honour_points  integer,
  login_count    integer,
  post_xp        float8,
  topic_xp       float8,
  like_xp        float8,
  trophy_xp      float8,
  honour_xp      float8,
  login_xp       float8,
  total_xp       float8,
  level_num      integer,
  xp_to_next     integer,
  rank_name      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  weights   jsonb;
  w_post    float8;
  w_topic   float8;
  w_like    float8;
  w_trophy  float8;
  w_honour  float8;
  w_login   float8;
BEGIN
  PERFORM assert_is_admin();

  SELECT jsonb_object_agg(
    source_key,
    CASE WHEN enabled THEN weight ELSE 0 END
  ) INTO weights
  FROM xp_source_weights;

  w_post   := COALESCE((weights->>'post')::float8,          0);
  w_topic  := COALESCE((weights->>'topic')::float8,         0);
  w_like   := COALESCE((weights->>'like_received')::float8, 0);
  w_trophy := COALESCE((weights->>'trophy_point')::float8,  0);
  w_honour := COALESCE((weights->>'honour_bonus')::float8,  0);
  w_login  := COALESCE((weights->>'login')::float8,         0);

  RETURN QUERY
  WITH
    post_counts AS (
      SELECT author_id, COUNT(*)::bigint AS n
      FROM posts
      WHERE deleted_at IS NULL
      GROUP BY author_id
    ),
    topic_counts AS (
      SELECT author_id, COUNT(*)::bigint AS n
      FROM topics
      GROUP BY author_id
    ),
    like_counts AS (
      SELECT p.author_id, COUNT(pl.post_id)::bigint AS n
      FROM post_likes pl
      JOIN posts p ON p.id = pl.post_id
      GROUP BY p.author_id
    ),
    trophy_sums AS (
      SELECT pt.profile_id, COALESCE(SUM(t.points), 0)::bigint AS pts
      FROM profile_trophies pt
      JOIN trophies t ON t.id = pt.trophy_id
      GROUP BY pt.profile_id
    ),
    xp_calc AS (
      SELECT
        pr.id                           AS uid,
        pr.username,
        pr.display_name,
        COALESCE(pc.n,  0)              AS n_post,
        COALESCE(tc.n,  0)              AS n_topic,
        COALESCE(lc.n,  0)              AS n_like,
        COALESCE(ts.pts, 0)             AS n_trophy,
        pr.legacy_honour_points         AS n_honour,
        pr.login_count                  AS n_login,
        COALESCE(pc.n,  0) * w_post    AS x_post,
        COALESCE(tc.n,  0) * w_topic   AS x_topic,
        COALESCE(lc.n,  0) * w_like    AS x_like,
        COALESCE(ts.pts, 0) * w_trophy AS x_trophy,
        pr.legacy_honour_points * w_honour AS x_honour,
        pr.login_count * w_login        AS x_login
      FROM profiles pr
      LEFT JOIN post_counts   pc ON pc.author_id  = pr.id
      LEFT JOIN topic_counts  tc ON tc.author_id  = pr.id
      LEFT JOIN like_counts   lc ON lc.author_id  = pr.id
      LEFT JOIN trophy_sums   ts ON ts.profile_id = pr.id
    ),
    xp_totals AS (
      SELECT
        *,
        (x_post + x_topic + x_like + x_trophy + x_honour + x_login) AS total,
        FLOOR(SQRT(x_post + x_topic + x_like + x_trophy + x_honour + x_login))::integer AS lvl
      FROM xp_calc
    )
  SELECT
    xt.uid,
    xt.username,
    xt.display_name,
    xt.n_post,
    xt.n_topic,
    xt.n_like,
    xt.n_trophy,
    xt.n_honour,
    xt.n_login,
    xt.x_post,
    xt.x_topic,
    xt.x_like,
    xt.x_trophy,
    xt.x_honour,
    xt.x_login,
    xt.total,
    xt.lvl,
    GREATEST(0, POWER((xt.lvl + 1)::float8, 2)::float8 - xt.total)::integer,
    COALESCE(
      (SELECT lr.rank_name
       FROM level_ranks lr
       WHERE lr.min_level <= xt.lvl
       ORDER BY lr.min_level DESC
       LIMIT 1),
      '?'
    )
  FROM xp_totals xt
  ORDER BY xt.total DESC, xt.username ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_admin_levels_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_levels_overview() TO authenticated;
