-- Levels system: XP source weights, rank names, and admin overview.
--
-- Formula (matches legacy forum exactly):
--   total_xp = SUM(source_count * source_weight)  for enabled sources
--   level    = FLOOR(SQRT(total_xp))
--   xp_to_next = (level + 1)^2 - total_xp
--
-- Sources: post, topic, like_received, trophy_point, login

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS xp_source_weights (
  source_key  text    PRIMARY KEY,
  label       text    NOT NULL,
  weight      numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  enabled     boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS level_ranks (
  min_level  integer PRIMARY KEY CHECK (min_level >= 0),
  rank_name  text    NOT NULL   CHECK (length(trim(rank_name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Default data ──────────────────────────────────────────────────────────

INSERT INTO xp_source_weights (source_key, label, weight, enabled) VALUES
  ('post',          'Viesti',        1.0, true),
  ('topic',         'Ketju',         2.0, true),
  ('like_received', 'Tykkäys saatu', 1.0, true),
  ('trophy_point',  'Pokaalipiste',  1.0, true),
  ('login',         'Kirjautuminen', 0.5, true)
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO level_ranks (min_level, rank_name) VALUES
  (0,   'pahvinyyppä'),
  (5,   'peltinörtti'),
  (10,  'rautanörtti'),
  (15,  'kevlarnörtti'),
  (20,  'hopeam4ph4x0r'),
  (30,  'kultam4ph4x0r'),
  (40,  'rautafriikkaaja'),
  (50,  'kultafriikkaaja'),
  (60,  'timanttifriikkaaja'),
  (75,  'teh penultimate fr34x0r'),
  (100, 'teh ultimate fr34x0r'),
  (125, 'teh ultimate fr34x0r^∞')
ON CONFLICT (min_level) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE xp_source_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_ranks        ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read both tables (rank names needed for profile display).
DROP POLICY IF EXISTS "Authenticated can read xp_source_weights" ON xp_source_weights;
CREATE POLICY "Authenticated can read xp_source_weights" ON xp_source_weights
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read level_ranks" ON level_ranks;
CREATE POLICY "Authenticated can read level_ranks" ON level_ranks
  FOR SELECT USING (auth.uid() IS NOT NULL);

GRANT SELECT ON xp_source_weights TO authenticated;
GRANT SELECT ON level_ranks        TO authenticated;

-- ── Admin RPCs ────────────────────────────────────────────────────────────

-- Returns full config: weights array + rank names array.
DROP FUNCTION IF EXISTS get_levels_config();
CREATE OR REPLACE FUNCTION get_levels_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_is_admin();

  RETURN jsonb_build_object(
    'weights', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'source_key', source_key,
          'label',      label,
          'weight',     weight,
          'enabled',    enabled
        ) ORDER BY source_key
      )
      FROM xp_source_weights
    ),
    'ranks', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'min_level', min_level,
          'rank_name', rank_name
        ) ORDER BY min_level
      )
      FROM level_ranks
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION get_levels_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_levels_config() TO authenticated;


-- Updates weight and enabled flag for one source key.
DROP FUNCTION IF EXISTS set_xp_source_weight(text, numeric, boolean);
CREATE OR REPLACE FUNCTION set_xp_source_weight(
  p_source_key text,
  p_weight     numeric,
  p_enabled    boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_is_admin();

  IF p_weight < 0 THEN
    RAISE EXCEPTION 'weight must be >= 0';
  END IF;

  UPDATE xp_source_weights
  SET weight = p_weight, enabled = p_enabled
  WHERE source_key = p_source_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown source_key: %', p_source_key;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION set_xp_source_weight(text, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_xp_source_weight(text, numeric, boolean) TO authenticated;


-- Inserts or updates a level rank entry.
DROP FUNCTION IF EXISTS upsert_level_rank(integer, text);
CREATE OR REPLACE FUNCTION upsert_level_rank(
  p_min_level integer,
  p_rank_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_is_admin();

  IF p_min_level < 0 THEN
    RAISE EXCEPTION 'min_level must be >= 0';
  END IF;

  IF trim(p_rank_name) = '' THEN
    RAISE EXCEPTION 'rank_name cannot be empty';
  END IF;

  INSERT INTO level_ranks (min_level, rank_name)
  VALUES (p_min_level, trim(p_rank_name))
  ON CONFLICT (min_level) DO UPDATE SET rank_name = trim(EXCLUDED.rank_name);
END;
$$;

REVOKE ALL ON FUNCTION upsert_level_rank(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_level_rank(integer, text) TO authenticated;


-- Deletes a level rank entry. The base rank (min_level = 0) is protected.
DROP FUNCTION IF EXISTS delete_level_rank(integer);
CREATE OR REPLACE FUNCTION delete_level_rank(p_min_level integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_is_admin();

  IF p_min_level = 0 THEN
    RAISE EXCEPTION 'cannot delete the base rank (min_level = 0)';
  END IF;

  DELETE FROM level_ranks WHERE min_level = p_min_level;
END;
$$;

REVOKE ALL ON FUNCTION delete_level_rank(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_level_rank(integer) TO authenticated;


-- Returns all users with full XP breakdown, level, and rank. Admin only.
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
  login_count    integer,
  post_xp        float8,
  topic_xp       float8,
  like_xp        float8,
  trophy_xp      float8,
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
  weights  jsonb;
  w_post   float8;
  w_topic  float8;
  w_like   float8;
  w_trophy float8;
  w_login  float8;
BEGIN
  PERFORM assert_is_admin();

  -- Read weights; treat disabled sources as weight 0.
  SELECT jsonb_object_agg(
    source_key,
    CASE WHEN enabled THEN weight ELSE 0 END
  ) INTO weights
  FROM xp_source_weights;

  w_post   := COALESCE((weights->>'post')::float8,          0);
  w_topic  := COALESCE((weights->>'topic')::float8,         0);
  w_like   := COALESCE((weights->>'like_received')::float8, 0);
  w_trophy := COALESCE((weights->>'trophy_point')::float8,  0);
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
        pr.id                          AS uid,
        pr.username,
        pr.display_name,
        COALESCE(pc.n,  0)             AS n_post,
        COALESCE(tc.n,  0)             AS n_topic,
        COALESCE(lc.n,  0)             AS n_like,
        COALESCE(ts.pts, 0)            AS n_trophy,
        pr.login_count                 AS n_login,
        COALESCE(pc.n,  0) * w_post   AS x_post,
        COALESCE(tc.n,  0) * w_topic  AS x_topic,
        COALESCE(lc.n,  0) * w_like   AS x_like,
        COALESCE(ts.pts, 0) * w_trophy AS x_trophy,
        pr.login_count * w_login       AS x_login
      FROM profiles pr
      LEFT JOIN post_counts   pc ON pc.author_id  = pr.id
      LEFT JOIN topic_counts  tc ON tc.author_id  = pr.id
      LEFT JOIN like_counts   lc ON lc.author_id  = pr.id
      LEFT JOIN trophy_sums   ts ON ts.profile_id = pr.id
    ),
    xp_totals AS (
      SELECT
        *,
        (x_post + x_topic + x_like + x_trophy + x_login)         AS total,
        FLOOR(SQRT(x_post + x_topic + x_like + x_trophy + x_login))::integer AS lvl
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
    xt.n_login,
    xt.x_post,
    xt.x_topic,
    xt.x_like,
    xt.x_trophy,
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
