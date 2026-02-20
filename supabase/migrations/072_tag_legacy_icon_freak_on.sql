-- Ensure Freak On tag uses legacy icon regardless of slug variant.

UPDATE tags
SET legacy_icon_path = '/tags/legacy/freakon.gif'
WHERE redirect_to_tag_id IS NULL
  AND (
    slug IN ('freakon', 'freak-on')
    OR lower(name) = 'freak on'
  );
