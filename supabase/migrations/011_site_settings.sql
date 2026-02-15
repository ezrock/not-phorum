-- Site settings key-value table
CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Default settings
INSERT INTO site_settings (key, value) VALUES ('registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Allow all authenticated users to read settings
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site_settings" ON site_settings FOR SELECT USING (true);

-- RPC to update a setting (admin-only)
CREATE OR REPLACE FUNCTION update_site_setting(setting_key text, setting_value text)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  UPDATE site_settings SET value = setting_value WHERE key = setting_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION update_site_setting(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_site_setting(text, text) TO authenticated;
