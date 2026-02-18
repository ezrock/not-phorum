-- Add per-event logo toggle

ALTER TABLE site_events
ADD COLUMN IF NOT EXISTS logo_enabled boolean NOT NULL DEFAULT false;
