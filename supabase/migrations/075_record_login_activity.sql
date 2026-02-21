-- Atomic login activity tracking:
-- - always increments login_count
-- - optionally tracks privacy-preserving network fingerprint

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
  SET login_count = COALESCE(login_count, 0) + 1
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
        seen_count = seen_count + 1
      WHERE profile_id = target_user_id
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
    'login_count', next_login_count,
    'login_network_count', next_network_count,
    'network_tracked', normalized_fingerprint IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION record_login_activity(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_login_activity(uuid, text) TO authenticated;
