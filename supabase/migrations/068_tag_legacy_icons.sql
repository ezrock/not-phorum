-- Legacy 2004-era tag icon support.
-- Keep existing tag.icon (emoji/current style) untouched and store legacy assets separately.

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS legacy_icon_path text;

WITH legacy_map(slug, filename) AS (
  VALUES
    ('8-bit-commodore', '8-bit_commodore.gif'),
    ('amiga', 'amiga.gif'),
    ('arcade', 'arcade.gif'),
    ('dreamcast', 'dreamcast.gif'),
    ('figut', 'figut.gif'),
    ('freakon', 'freakon.gif'),
    ('gameboy', 'gameboy.gif'),
    ('gamecube', 'gamecube.gif'),
    ('gamepark', 'gamepark.gif'),
    ('internet', 'internet.gif'),
    ('kirjat-ja-lehdet', 'kirjat_ja_lehdet.gif'),
    ('korttipelit', 'korttipelit.gif'),
    ('lautapelit', 'lautapelit.gif'),
    ('leffat', 'leffat.gif'),
    ('mobiilipelit', 'mobiilipelit.gif'),
    ('musiikki', 'musiikki.gif'),
    ('n-gage', 'n-gage.gif'),
    ('nes', 'nes.gif'),
    ('nintendo-64', 'nintendo_64.gif'),
    ('nintendo-ds', 'nintendo_ds.gif'),
    ('off-topic', 'off-topic.gif'),
    ('pc-pelit', 'pc-pelit.gif'),
    ('playstation-1', 'playstation_1.gif'),
    ('playstation-2', 'playstation_2.gif'),
    ('playstation-3', 'playstation_3.gif'),
    ('pokemonit', 'pokemonit.gif'),
    ('psp', 'psp.gif'),
    ('revolution', 'revolution.gif'),
    ('roolipelit', 'roolipelit.gif'),
    ('sarjakuvat', 'sarjakuvat.gif'),
    ('selainpelit', 'selainpelit.gif'),
    ('snes', 'snes.gif'),
    ('urheilu', 'urheilu.gif'),
    ('vimpaimet', 'vimpaimet.gif'),
    ('xbox', 'xbox.gif'),
    ('xbox-360', 'xbox_360.gif')
)
UPDATE tags t
SET legacy_icon_path = '/tags/legacy/' || m.filename
FROM legacy_map m
WHERE t.redirect_to_tag_id IS NULL
  AND t.slug = m.slug;

DROP FUNCTION IF EXISTS get_admin_canonical_tags_with_usage();
CREATE OR REPLACE FUNCTION get_admin_canonical_tags_with_usage()
RETURNS TABLE (
  id bigint,
  name text,
  slug text,
  legacy_icon_path text,
  usage_count bigint,
  alias_count bigint,
  group_membership_count bigint,
  redirect_reference_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(p.is_admin, false)
  INTO caller_is_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_is_admin = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.slug,
    t.legacy_icon_path,
    COALESCE(tt_usage.cnt, 0) AS usage_count,
    COALESCE(ta_usage.cnt, 0) AS alias_count,
    COALESCE(tgm_usage.cnt, 0) AS group_membership_count,
    COALESCE(redirect_usage.cnt, 0) AS redirect_reference_count
  FROM tags t
  LEFT JOIN (
    SELECT tt.tag_id, COUNT(*)::bigint AS cnt
    FROM topic_tags tt
    GROUP BY tt.tag_id
  ) tt_usage ON tt_usage.tag_id = t.id
  LEFT JOIN (
    SELECT ta.tag_id, COUNT(*)::bigint AS cnt
    FROM tag_aliases ta
    GROUP BY ta.tag_id
  ) ta_usage ON ta_usage.tag_id = t.id
  LEFT JOIN (
    SELECT gm.tag_id, COUNT(*)::bigint AS cnt
    FROM tag_group_members gm
    GROUP BY gm.tag_id
  ) tgm_usage ON tgm_usage.tag_id = t.id
  LEFT JOIN (
    SELECT t2.redirect_to_tag_id AS tag_id, COUNT(*)::bigint AS cnt
    FROM tags t2
    WHERE t2.redirect_to_tag_id IS NOT NULL
    GROUP BY t2.redirect_to_tag_id
  ) redirect_usage ON redirect_usage.tag_id = t.id
  WHERE t.redirect_to_tag_id IS NULL
    AND t.status <> 'hidden'
  ORDER BY t.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_admin_canonical_tags_with_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_admin_canonical_tags_with_usage() TO authenticated;
