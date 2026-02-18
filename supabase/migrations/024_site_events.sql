-- Event presets managed from Admin

CREATE TABLE IF NOT EXISTS site_events (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  event_date date NOT NULL,
  music_enabled boolean NOT NULL DEFAULT false,
  music_file text,
  logo_file text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_events_event_date ON site_events(event_date DESC);

ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read site_events" ON site_events;
CREATE POLICY "Authenticated can read site_events"
  ON site_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin can insert site_events" ON site_events;
CREATE POLICY "Admin can insert site_events"
  ON site_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admin can update site_events" ON site_events;
CREATE POLICY "Admin can update site_events"
  ON site_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admin can delete site_events" ON site_events;
CREATE POLICY "Admin can delete site_events"
  ON site_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE OR REPLACE FUNCTION set_site_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_events_updated_at ON site_events;
CREATE TRIGGER trg_site_events_updated_at
BEFORE UPDATE ON site_events
FOR EACH ROW
EXECUTE FUNCTION set_site_events_updated_at();
