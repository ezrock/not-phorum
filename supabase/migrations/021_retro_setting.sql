INSERT INTO site_settings (key, value) VALUES ('retro_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
