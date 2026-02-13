-- Add profile image URL to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Add image URL to posts for attachments
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url text;
