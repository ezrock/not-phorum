-- Privacy-focused login network tracking using server-generated fingerprints

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS login_network_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS profile_login_networks (
  id bigserial PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  network_fingerprint text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seen_count integer NOT NULL DEFAULT 1,
  UNIQUE (profile_id, network_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_profile_login_networks_profile_id
  ON profile_login_networks(profile_id);

ALTER TABLE profile_login_networks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own login networks" ON profile_login_networks;
CREATE POLICY "Users can read own login networks"
  ON profile_login_networks FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can insert own login networks" ON profile_login_networks;
CREATE POLICY "Users can insert own login networks"
  ON profile_login_networks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can update own login networks" ON profile_login_networks;
CREATE POLICY "Users can update own login networks"
  ON profile_login_networks FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP FUNCTION IF EXISTS track_login_network(uuid, text);
CREATE OR REPLACE FUNCTION track_login_network(target_user_id uuid, fingerprint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF fingerprint IS NULL OR length(trim(fingerprint)) < 16 THEN
    RAISE EXCEPTION 'Invalid fingerprint';
  END IF;

  INSERT INTO profile_login_networks (profile_id, network_fingerprint, first_seen_at, last_seen_at, seen_count)
  VALUES (target_user_id, fingerprint, now(), now(), 1)
  ON CONFLICT (profile_id, network_fingerprint) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 0 THEN
    UPDATE profile_login_networks
    SET
      last_seen_at = now(),
      seen_count = seen_count + 1
    WHERE profile_id = target_user_id
      AND network_fingerprint = fingerprint;
  END IF;

  UPDATE profiles
  SET login_network_count = (
    SELECT COUNT(*)::integer
    FROM profile_login_networks
    WHERE profile_id = target_user_id
  )
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION track_login_network(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION track_login_network(uuid, text) TO authenticated;
