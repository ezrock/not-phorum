-- Add profile fields: display name, signature, profile link
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_signature boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS link_description text;
