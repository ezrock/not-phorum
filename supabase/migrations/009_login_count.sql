-- Add login count to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;

-- RPC function to atomically increment own login count
DROP FUNCTION IF EXISTS increment_login_count(uuid);

CREATE OR REPLACE FUNCTION increment_login_count(target_user_id uuid)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE profiles
  SET login_count = COALESCE(login_count, 0) + 1
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION increment_login_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_login_count(uuid) TO authenticated;
