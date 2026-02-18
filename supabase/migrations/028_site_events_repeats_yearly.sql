-- Per-event toggle for yearly recurrence

ALTER TABLE site_events
ADD COLUMN IF NOT EXISTS repeats_yearly boolean NOT NULL DEFAULT true;
