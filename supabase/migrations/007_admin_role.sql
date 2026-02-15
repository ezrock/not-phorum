-- Add admin role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Set all existing users as admins
UPDATE profiles SET is_admin = true;
