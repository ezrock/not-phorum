-- Per-user tag icon style selection:
-- true  -> 2004 (legacy icons)
-- false -> 2026 (modern icons)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS legacy_tag_icons_enabled boolean NOT NULL DEFAULT true;
