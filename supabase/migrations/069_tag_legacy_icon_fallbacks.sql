-- Apply agreed legacy icon fallbacks for post-2004 tags.

UPDATE tags
SET legacy_icon_path = '/tags/legacy/nintendo-wii.gif'
WHERE redirect_to_tag_id IS NULL
  AND slug IN ('nintendo-wii', 'nintendo-switch');

UPDATE tags
SET legacy_icon_path = '/tags/legacy/playstation_3.gif'
WHERE redirect_to_tag_id IS NULL
  AND slug IN ('playstation-4', 'playstation-5');

UPDATE tags
SET legacy_icon_path = '/tags/legacy/xbox.gif'
WHERE redirect_to_tag_id IS NULL
  AND slug IN ('xbox-one', 'xbox-series');

UPDATE tags
SET legacy_icon_path = '/tags/legacy/pc-pelit.gif'
WHERE redirect_to_tag_id IS NULL
  AND slug = 'steamdeck';
