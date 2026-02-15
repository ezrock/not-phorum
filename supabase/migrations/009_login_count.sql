-- Add login count to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;

-- RPC function to atomically increment login count
CREATE OR REPLACE FUNCTION increment_login_count(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET login_count = login_count + 1 WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
