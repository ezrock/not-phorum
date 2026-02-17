-- Notification stripe settings

INSERT INTO site_settings (key, value) VALUES
  ('notification_enabled', 'false'),
  ('notification_message', '')
ON CONFLICT (key) DO NOTHING;

-- Make setting updates robust for new keys as well.
CREATE OR REPLACE FUNCTION update_site_setting(setting_key text, setting_value text)
RETURNS void AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  INSERT INTO site_settings (key, value)
  VALUES (setting_key, setting_value)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION update_site_setting(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_site_setting(text, text) TO authenticated;
