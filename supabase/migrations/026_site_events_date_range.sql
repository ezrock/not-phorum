-- Add recurring date range support for site events

ALTER TABLE site_events
ADD COLUMN IF NOT EXISTS date_range_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE site_events
ADD COLUMN IF NOT EXISTS range_start_date date;

ALTER TABLE site_events
ADD COLUMN IF NOT EXISTS range_end_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'site_events_date_range_fields_chk'
  ) THEN
    ALTER TABLE site_events
    ADD CONSTRAINT site_events_date_range_fields_chk
    CHECK (
      date_range_enabled = false
      OR (range_start_date IS NOT NULL AND range_end_date IS NOT NULL)
    );
  END IF;
END
$$;
