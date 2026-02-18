-- Per-user preference for MIDI audio

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS midi_enabled boolean NOT NULL DEFAULT false;
