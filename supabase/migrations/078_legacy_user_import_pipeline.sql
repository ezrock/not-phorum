-- Legacy forum user import pipeline (single source: old forums_auth dump).
-- Phase 1: load old users into legacy_forum_auth_import.
-- Phase 2: preview equivalence with get_legacy_user_equivalence().
-- Phase 3: apply matched updates with apply_legacy_user_import().

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS legacy_forum_user_id integer;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_legacy_forum_user_id_uq
  ON profiles (legacy_forum_user_id)
  WHERE legacy_forum_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS legacy_forum_auth_import (
  id integer PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  webpage text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  icq text NOT NULL DEFAULT '',
  aol text NOT NULL DEFAULT '',
  yahoo text NOT NULL DEFAULT '',
  msn text NOT NULL DEFAULT '',
  jabber text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  hide_email boolean NOT NULL DEFAULT false,
  permission_level integer NOT NULL DEFAULT 0,
  max_group_permission_level integer NOT NULL DEFAULT 0,
  lang text NOT NULL DEFAULT '',
  password_tmp text NOT NULL DEFAULT '',
  combined_token text NOT NULL DEFAULT '',
  mood integer NULL,
  mood_updated_at timestamptz NULL
);

CREATE OR REPLACE FUNCTION legacy_normalize_nonempty(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(btrim(COALESCE(input, '')), '');
$$;

CREATE OR REPLACE FUNCTION legacy_normalize_email(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text := lower(btrim(COALESCE(input, '')));
BEGIN
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  -- Common placeholders in legacy data.
  IF normalized IN ('---------', '-', 'n/a', 'none') THEN
    RETURN NULL;
  END IF;

  IF position('@' IN normalized) = 0 THEN
    RETURN NULL;
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION legacy_normalize_http_url(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
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

DROP FUNCTION IF EXISTS get_legacy_user_equivalence();
CREATE OR REPLACE FUNCTION get_legacy_user_equivalence()
RETURNS TABLE (
  legacy_user_id integer,
  legacy_username text,
  profile_id uuid,
  matched_by text,
  action text,
  current_username text,
  legacy_created_at timestamptz,
  current_created_at timestamptz,
  next_created_at timestamptz,
  current_email text,
  legacy_email text,
  next_email text,
  current_profile_image_url text,
  legacy_profile_image_url text,
  next_profile_image_url text,
  current_signature text,
  legacy_signature text,
  next_signature text,
  current_hide_email boolean,
  legacy_hide_email boolean,
  next_hide_email boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_is_admin();

  RETURN QUERY
  WITH normalized_legacy AS (
    SELECT
      l.id AS legacy_user_id,
      btrim(l.username) AS legacy_username,
      l.mood_updated_at AS legacy_created_at,
      legacy_normalize_email(l.email) AS legacy_email,
      legacy_normalize_http_url(l.image) AS legacy_profile_image_url,
      legacy_normalize_nonempty(l.signature) AS legacy_signature,
      COALESCE(l.hide_email, false) AS legacy_hide_email
    FROM legacy_forum_auth_import l
    WHERE btrim(COALESCE(l.username, '')) <> ''
  ),
  matched AS (
    SELECT
      nl.*,
      mp.id AS profile_id,
      mp.username AS current_username,
      mp.created_at AS current_created_at,
      mp.profile_image_url AS current_profile_image_url,
      mp.signature AS current_signature,
      COALESCE(mp.hide_email, false) AS current_hide_email,
      au.email AS current_email
    FROM normalized_legacy nl
    LEFT JOIN LATERAL (
      SELECT p.id, p.username, p.created_at, p.profile_image_url, p.signature, p.hide_email
      FROM profiles p
      WHERE lower(p.username) = lower(nl.legacy_username)
      ORDER BY
        CASE WHEN p.username = nl.legacy_username THEN 0 ELSE 1 END,
        p.created_at ASC
      LIMIT 1
    ) mp ON true
    LEFT JOIN auth.users au ON au.id = mp.id
  )
  SELECT
    m.legacy_user_id,
    m.legacy_username,
    m.profile_id,
    CASE
      WHEN m.profile_id IS NULL THEN 'unmatched'
      WHEN m.current_username = m.legacy_username THEN 'username_exact'
      ELSE 'username_case_insensitive'
    END AS matched_by,
    CASE
      WHEN m.profile_id IS NULL THEN 'create_needed'
      ELSE 'update_existing'
    END AS action,
    m.current_username,
    m.legacy_created_at,
    m.current_created_at,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_created_at
      ELSE COALESCE(m.legacy_created_at, m.current_created_at)
    END AS next_created_at,
    m.current_email,
    m.legacy_email,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_email
      WHEN legacy_normalize_nonempty(m.current_email) IS NOT NULL THEN m.current_email
      ELSE m.legacy_email
    END AS next_email,
    m.current_profile_image_url,
    m.legacy_profile_image_url,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_profile_image_url
      WHEN legacy_normalize_nonempty(m.current_profile_image_url) IS NOT NULL THEN m.current_profile_image_url
      ELSE m.legacy_profile_image_url
    END AS next_profile_image_url,
    m.current_signature,
    m.legacy_signature,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_signature
      WHEN legacy_normalize_nonempty(m.current_signature) IS NOT NULL THEN m.current_signature
      ELSE m.legacy_signature
    END AS next_signature,
    m.current_hide_email,
    m.legacy_hide_email,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_hide_email
      WHEN m.legacy_hide_email THEN true
      ELSE m.current_hide_email
    END AS next_hide_email
  FROM matched m
  ORDER BY m.legacy_user_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_legacy_user_equivalence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_legacy_user_equivalence() TO authenticated;

DROP FUNCTION IF EXISTS apply_legacy_user_import();
CREATE OR REPLACE FUNCTION apply_legacy_user_import()
RETURNS TABLE (
  legacy_user_id integer,
  profile_id uuid,
  action text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_item RECORD;
BEGIN
  PERFORM assert_is_admin();

  FOR row_item IN
    SELECT *
    FROM get_legacy_user_equivalence()
    ORDER BY legacy_user_id
  LOOP
    IF row_item.action = 'update_existing' THEN
      UPDATE profiles
      SET
        legacy_forum_user_id = row_item.legacy_user_id,
        created_at = COALESCE(row_item.legacy_created_at, created_at),
        profile_image_url = CASE
          WHEN legacy_normalize_nonempty(profile_image_url) IS NOT NULL THEN profile_image_url
          ELSE row_item.legacy_profile_image_url
        END,
        signature = CASE
          WHEN legacy_normalize_nonempty(signature) IS NOT NULL THEN signature
          ELSE row_item.legacy_signature
        END,
        hide_email = CASE
          WHEN row_item.legacy_hide_email THEN true
          ELSE hide_email
        END
      WHERE id = row_item.profile_id;

      -- Keep existing new-forum email if present; only backfill when missing.
      IF row_item.legacy_email IS NOT NULL
         AND legacy_normalize_nonempty(row_item.current_email) IS NULL THEN
        UPDATE auth.users
        SET
          email = row_item.legacy_email,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE id = row_item.profile_id;
      END IF;

      legacy_user_id := row_item.legacy_user_id;
      profile_id := row_item.profile_id;
      action := 'updated_existing';
      RETURN NEXT;
    ELSE
      legacy_user_id := row_item.legacy_user_id;
      profile_id := NULL;
      action := 'create_needed';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION apply_legacy_user_import() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_legacy_user_import() TO authenticated;
