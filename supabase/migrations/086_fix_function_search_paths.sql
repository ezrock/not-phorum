-- Fix function_search_path_mutable warnings:
-- All flagged functions get SET search_path = public so that an attacker who
-- can create objects in a schema earlier in the search_path cannot shadow
-- built-in functions or project tables.
--
-- Also moves the pg_trgm extension from public to extensions schema
-- (fixes extension_in_public warning), and updates search_forum's
-- search_path to include extensions so similarity() is still found.

-- ─── pg_trgm: move to extensions schema ──────────────────────────────────────
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- ─── search_forum: add extensions to search_path ─────────────────────────────
-- similarity() is provided by pg_trgm, which now lives in the extensions schema.
CREATE OR REPLACE FUNCTION public.search_forum(search_term text, result_limit int DEFAULT 20)
RETURNS TABLE (
  result_type text,
  topic_id bigint,
  topic_title text,
  content_snippet text,
  category_name text,
  category_icon text,
  author_username text,
  author_avatar text,
  author_profile_image_url text,
  similarity_score real,
  created_at timestamptz,
  last_post_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  WITH last_posts AS (
    SELECT DISTINCT ON (p.topic_id)
      p.topic_id,
      p.created_at AS last_post_created_at
    FROM posts p
    WHERE p.deleted_at IS NULL
    ORDER BY p.topic_id, p.created_at DESC, p.id DESC
  )
  SELECT
    'topic'::text AS result_type,
    t.id AS topic_id,
    t.title AS topic_title,
    NULL::text AS content_snippet,
    COALESCE(primary_tag.name, 'Tagit') AS category_name,
    COALESCE(primary_tag.icon, '🏷️') AS category_icon,
    p.username AS author_username,
    NULL::text AS author_avatar,
    NULL::text AS author_profile_image_url,
    similarity(t.title, search_term) AS similarity_score,
    t.created_at,
    lp.last_post_created_at
  FROM topics t
  JOIN profiles p ON p.id = t.author_id
  LEFT JOIN last_posts lp ON lp.topic_id = t.id
  LEFT JOIN LATERAL (
    SELECT
      tag_row.name,
      COALESCE(NULLIF(btrim(tag_row.icon), ''), '🏷️') AS icon
    FROM topic_tags tt
    JOIN tags tag_row ON tag_row.id = tt.tag_id
    WHERE tt.topic_id = t.id
      AND tag_row.redirect_to_tag_id IS NULL
      AND tag_row.status <> 'hidden'
    ORDER BY tt.created_at ASC, tt.tag_id ASC
    LIMIT 1
  ) primary_tag ON true
  WHERE similarity(t.title, search_term) > 0.1
     OR t.title ILIKE '%' || search_term || '%'

  UNION ALL

  SELECT
    'post'::text AS result_type,
    po.topic_id,
    t.title AS topic_title,
    LEFT(po.content, 200) AS content_snippet,
    COALESCE(primary_tag.name, 'Tagit') AS category_name,
    COALESCE(primary_tag.icon, '🏷️') AS category_icon,
    pr.username AS author_username,
    NULL::text AS author_avatar,
    NULL::text AS author_profile_image_url,
    similarity(po.content, search_term) AS similarity_score,
    po.created_at,
    lp.last_post_created_at
  FROM posts po
  JOIN topics t ON t.id = po.topic_id
  JOIN profiles pr ON pr.id = po.author_id
  LEFT JOIN last_posts lp ON lp.topic_id = po.topic_id
  LEFT JOIN LATERAL (
    SELECT
      tag_row.name,
      COALESCE(NULLIF(btrim(tag_row.icon), ''), '🏷️') AS icon
    FROM topic_tags tt
    JOIN tags tag_row ON tag_row.id = tt.tag_id
    WHERE tt.topic_id = t.id
      AND tag_row.redirect_to_tag_id IS NULL
      AND tag_row.status <> 'hidden'
    ORDER BY tt.created_at ASC, tt.tag_id ASC
    LIMIT 1
  ) primary_tag ON true
  WHERE po.deleted_at IS NULL
    AND (
      similarity(po.content, search_term) > 0.1
      OR po.content ILIKE '%' || search_term || '%'
    )

  ORDER BY similarity_score DESC, last_post_created_at DESC NULLS LAST, created_at DESC
  LIMIT GREATEST(COALESCE(result_limit, 20), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.search_forum(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_forum(text, int) TO authenticated;

-- ─── Trigger / utility functions ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🎮')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_site_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_set_last_activity_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.author_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_set_last_activity_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET last_activity_at = GREATEST(COALESCE(last_activity_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.profile_id;
  RETURN NULL;
END;
$$;

-- ─── Tag helper functions ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_tag_alias(input_alias text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(input_alias, '')), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.slugify_tag_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(
        regexp_replace(
          regexp_replace(btrim(COALESCE(input_text, '')), '[^a-zA-Z0-9\s-]', '', 'g'),
          '\s+', '-', 'g'
        )
      ),
      '-+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_canonical_tag_id(input_tag_id bigint)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT t.id, t.redirect_to_tag_id, 0 AS depth
    FROM tags t
    WHERE t.id = input_tag_id

    UNION ALL

    SELECT t2.id, t2.redirect_to_tag_id, c.depth + 1
    FROM chain c
    JOIN tags t2 ON t2.id = c.redirect_to_tag_id
    WHERE c.redirect_to_tag_id IS NOT NULL
      AND c.depth < 32
  )
  SELECT c.id
  FROM chain c
  WHERE c.redirect_to_tag_id IS NULL
  ORDER BY c.depth DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_canonical_tag_ids(input_tag_ids bigint[] DEFAULT NULL)
RETURNS bigint[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT resolved.canonical_tag_id), ARRAY[]::bigint[])
  FROM (
    SELECT resolve_canonical_tag_id(source.tag_id) AS canonical_tag_id
    FROM unnest(COALESCE(input_tag_ids, ARRAY[]::bigint[])) AS source(tag_id)
  ) resolved
  JOIN tags canonical ON canonical.id = resolved.canonical_tag_id
  WHERE resolved.canonical_tag_id IS NOT NULL
    AND canonical.status <> 'hidden';
$$;

-- ─── Legacy import helper functions ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.legacy_normalize_nonempty(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(btrim(COALESCE(input, '')), '');
$$;

CREATE OR REPLACE FUNCTION public.legacy_normalize_email(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text := lower(btrim(COALESCE(input, '')));
BEGIN
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  IF normalized IN ('---------', '-', 'n/a', 'none') THEN
    RETURN NULL;
  END IF;

  IF position('@' IN normalized) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.legacy_normalize_http_url(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized text := btrim(COALESCE(input, ''));
BEGIN
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  IF normalized ~* '^https?://' THEN
    RETURN normalized;
  END IF;

  RETURN NULL;
END;
$$;
