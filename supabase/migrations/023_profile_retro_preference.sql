-- Per-user preference for retro visual effect

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS retro_enabled boolean NOT NULL DEFAULT false;
