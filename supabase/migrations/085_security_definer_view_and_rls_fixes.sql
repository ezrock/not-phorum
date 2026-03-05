-- Fix Supabase security linter errors:
-- 1. Recreate three SECURITY DEFINER views as SECURITY INVOKER so that
--    the querying user's RLS policies are enforced, not the view creator's.
-- 2. Enable RLS on legacy import staging tables so they are not exposed
--    via PostgREST (service_role bypasses RLS and can still access them).

-- ─── 1. topics_with_stats ────────────────────────────────────────────────────
-- DROP + CREATE instead of CREATE OR REPLACE: avoids "cannot change column name"
-- errors when the live view's materialised column list diverges from this file
-- (e.g. after columns were added to underlying tables).
DROP VIEW IF EXISTS public.topics_with_stats;
CREATE VIEW public.topics_with_stats
WITH (security_invoker = true) AS
SELECT
  t.*,
  p.username AS author_username,
  p.avatar AS author_avatar,
  c.name AS category_name,
  c.icon AS category_icon,
  c.slug AS category_slug,
  count(DISTINCT po.id) AS reply_count,
  max(po.created_at) AS last_activity
FROM public.topics t
LEFT JOIN public.profiles p ON t.author_id = p.id
LEFT JOIN public.categories c ON t.category_id = c.id
LEFT JOIN public.posts po ON t.id = po.topic_id
GROUP BY t.id, p.username, p.avatar, c.name, c.icon, c.slug;

-- ─── 2. posts_with_details ───────────────────────────────────────────────────
DROP VIEW IF EXISTS public.posts_with_details;
CREATE VIEW public.posts_with_details
WITH (security_invoker = true) AS
SELECT
  po.*,
  p.username AS author_username,
  p.avatar AS author_avatar,
  count(DISTINCT pl.id) AS likes_count
FROM public.posts po
LEFT JOIN public.profiles p ON po.author_id = p.id
LEFT JOIN public.post_likes pl ON po.id = pl.post_id
GROUP BY po.id, p.username, p.avatar;

-- ─── 3. admin_trophy_overview ────────────────────────────────────────────────
DROP VIEW IF EXISTS public.admin_trophy_overview;
CREATE VIEW public.admin_trophy_overview
WITH (security_invoker = true) AS
SELECT
  t.id,
  t.code,
  t.name,
  t.points,
  t.icon_path,
  t.source,
  COUNT(pt.id)::int AS awarded_count
FROM public.trophies t
LEFT JOIN public.profile_trophies pt ON pt.trophy_id = t.id
GROUP BY t.id, t.code, t.name, t.points, t.icon_path, t.source
ORDER BY t.points DESC, t.name ASC;

GRANT SELECT ON public.admin_trophy_overview TO authenticated;

-- ─── 4. RLS on legacy import staging tables ──────────────────────────────────
-- These tables are internal import helpers accessed only via service_role,
-- which bypasses RLS. Enabling RLS with no permissive policies blocks all
-- PostgREST / anon / authenticated access, removing the data exposure risk.

ALTER TABLE public.legacy_forum_auth_import ENABLE ROW LEVEL SECURITY;

-- legacy_phorum_users_raw and legacy_forum_auth_raw were created outside
-- migrations; guard with DO blocks so this migration is idempotent in
-- environments where they do not exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legacy_phorum_users_raw'
  ) THEN
    EXECUTE 'ALTER TABLE public.legacy_phorum_users_raw ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'legacy_forum_auth_raw'
  ) THEN
    EXECUTE 'ALTER TABLE public.legacy_forum_auth_raw ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
