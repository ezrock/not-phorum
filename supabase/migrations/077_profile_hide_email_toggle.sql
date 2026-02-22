-- Add per-profile email visibility preference.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hide_email boolean NOT NULL DEFAULT false;

-- Extend admin profile update RPC with hide_email support.
DROP FUNCTION IF EXISTS admin_update_profile(uuid, text, text, text, text, boolean, text, text, text, boolean);
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
  p_email              text,
  p_hide_email         boolean
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
    link_description   = NULLIF(btrim(COALESCE(p_link_description, '')), ''),
    hide_email         = COALESCE(p_hide_email, false)
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

REVOKE ALL ON FUNCTION admin_update_profile(uuid, text, text, text, text, boolean, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_profile(uuid, text, text, text, text, boolean, text, text, text, boolean) TO authenticated;
