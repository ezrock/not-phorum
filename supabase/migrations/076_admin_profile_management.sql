-- Admin profile management RPCs:
-- 1) get_user_email   – read another user's email (admin only)
-- 2) admin_update_profile – update profile fields + email for any user (admin only)

-- ─────────────────────────────────────────────────────────────────────────────
-- get_user_email
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_user_email(uuid);
CREATE OR REPLACE FUNCTION get_user_email(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  PERFORM assert_is_admin();

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = target_user_id;

  RETURN user_email;
END;
$$;

REVOKE ALL ON FUNCTION get_user_email(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- admin_update_profile
-- All profile fields are required (pass the existing value to leave unchanged).
-- p_email: if non-empty, update auth.users.email immediately (no confirmation).
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS admin_update_profile(uuid, text, text, text, text, boolean, text, text, text);
CREATE OR REPLACE FUNCTION admin_update_profile(
  target_user_id       uuid,
  p_username           text,
  p_display_name       text,
  p_profile_image_url  text,
  p_signature          text,
  p_show_signature     boolean,
  p_link_url           text,
  p_link_description   text,
  p_email              text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed_username text := btrim(COALESCE(p_username, ''));
  trimmed_email    text := btrim(COALESCE(p_email, ''));
BEGIN
  PERFORM assert_is_admin();

  IF char_length(trimmed_username) < 3 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Käyttäjätunnus on liian lyhyt (vähintään 3 merkkiä)',
      DETAIL  = 'validation.username_too_short';
  END IF;

  UPDATE profiles
  SET
    username           = trimmed_username,
    display_name       = NULLIF(btrim(COALESCE(p_display_name, '')), ''),
    profile_image_url  = NULLIF(btrim(COALESCE(p_profile_image_url, '')), ''),
    signature          = NULLIF(btrim(COALESCE(p_signature, '')), ''),
    show_signature     = COALESCE(p_show_signature, true),
    link_url           = NULLIF(btrim(COALESCE(p_link_url, '')), ''),
    link_description   = NULLIF(btrim(COALESCE(p_link_description, '')), '')
  WHERE id = target_user_id;

  IF char_length(trimmed_email) > 0 THEN
    UPDATE auth.users
    SET
      email              = trimmed_email,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = target_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION admin_update_profile(uuid, text, text, text, text, boolean, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_profile(uuid, text, text, text, text, boolean, text, text, text) TO authenticated;
