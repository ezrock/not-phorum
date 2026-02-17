-- Per-user preference for realtime forum updates

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS realtime_updates_enabled boolean NOT NULL DEFAULT false;

