-- Legacy import follow-up: add date_added from phorum_users, backfill created_at.
--
-- phorum_users.date_added is a Unix timestamp of original registration.
-- For the bulk-migrated cohort (users 1–44, all ~2005-07-05) timestamps cluster
-- within seconds of each other; for all later sign-ups they are individual dates.
--
-- date_last_active equals date_added for every user in the dump (tracking was
-- not preserved during the Phorum migration), so only date_added is imported.

-- ── 1. Add column ─────────────────────────────────────────────────────────

ALTER TABLE legacy_forum_auth_import
  ADD COLUMN IF NOT EXISTS date_added integer;

-- ── 2. Populate from phorum_users data ────────────────────────────────────

UPDATE legacy_forum_auth_import AS l
SET date_added = v.da
FROM (VALUES
  -- (phorum user_id, date_added unix timestamp)
  ( 1, 1120594727),  -- admin
  ( 2, 1120595194),  -- pikemon
  ( 4, 1120595194),  -- subjik
  ( 6, 1120595194),  -- e-z
  ( 7, 1120595194),  -- sampster
  ( 8, 1120595194),  -- test
  ( 9, 1120595194),  -- x-tend
  (10, 1120595194),  -- jones
  (11, 1120595194),  -- marqs
  (12, 1120595194),  -- kataja
  (13, 1120595194),  -- killatorspo
  (14, 1120595194),  -- WillSmith
  (15, 1120595194),  -- Ante
  (16, 1120595194),  -- uniko1
  (17, 1120595194),  -- Ruudolf
  (18, 1120595194),  -- lemody
  (19, 1120595194),  -- manne
  (20, 1120595194),  -- Eemo1
  (21, 1120595194),  -- miggo
  (22, 1120595194),  -- alex
  (23, 1120595194),  -- tontsa
  (24, 1120595195),  -- jaxen
  (25, 1120595194),  -- 744-V3771
  (26, 1120595195),  -- masmad
  (27, 1120595195),  -- xjanix
  (28, 1120595195),  -- Antti P.
  (29, 1120595195),  -- laurimau
  (30, 1120595195),  -- fonola
  (31, 1120595195),  -- juho
  (33, 1120595195),  -- anttiszu
  (34, 1120595195),  -- Sub
  (35, 1120595195),  -- Hypn0sis
  (36, 1120595195),  -- proge
  (37, 1120595195),  -- tokio
  (38, 1120595195),  -- y0pparai
  (39, 1120595195),  -- justepp
  (40, 1120595195),  -- antti_ass
  (41, 1120595195),  -- lorem
  (42, 1120595195),  -- gunjah
  (43, 1120595195),  -- pink10speed
  (44, 1120595195),  -- noboca
  (45, 1121106074),  -- Sanguine      (2005-07-11)
  (46, 1125380289),  -- wasara        (2005-08-29)
  (47, 1150352699),  -- melbaholic    (2006-06-15)
  (48, 1153500118),  -- sally_vanilla (2006-07-21)
  (49, 1167904892),  -- tuoski        (2007-01-04)
  (50, 1169136545),  -- teemu         (2007-01-18)
  (51, 1169468845),  -- samuli        (2007-01-22)
  (52, 1169801542),  -- Viktor Laszlo (2007-01-26)
  (53, 1180892753),  -- Minttu        (2007-06-03)
  (54, 1187009219),  -- pasi          (2007-08-13)
  (55, 1192095764),  -- hellsink      (2007-10-11)
  (56, 1192105955),  -- Seinfold      (2007-10-11)
  (57, 1194372950),  -- mlahtinen6   (2007-11-06)
  (58, 1200570006),  -- vesuri        (2008-01-17)
  (59, 1200577840),  -- neetta        (2008-01-17)
  (60, 1207580780),  -- turntalebanist (2008-04-07)
  (61, 1207751663),  -- hollower      (2008-04-09)
  (62, 1207823128),  -- Kintzi        (2008-04-10)
  (63, 1211386238),  -- jazmanaut     (2008-05-21)
  (64, 1215954010),  -- kluster       (2008-07-13)
  (65, 1224494721),  -- toni          (2008-10-20)
  (66, 1225352780),  -- Lescott       (2008-10-29)
  (67, 1225787300),  -- zenbucket     (2008-11-04)
  (68, 1227696735),  -- petteri12     (2008-11-26)
  (69, 1228132893),  -- haltija       (2008-12-01)
  (70, 1228138916),  -- genki         (2008-12-01)
  (71, 1232778755),  -- ViljaMies     (2009-01-23)
  (72, 1237473608),  -- kippiorja     (2009-03-19)
  (73, 1253132427),  -- olli          (2009-09-17)
  (74, 1259577880),  -- matti         (2009-11-30)
  (75, 1269876616),  -- Deus          (2010-03-29)
  (76, 1273492459),  -- Grarkko       (2010-05-10)
  (77, 1276867997),  -- forssto       (2010-06-18)
  (78, 1276868623),  -- tommif        (2010-06-18)
  (79, 1280573154),  -- waremo        (2010-07-31)
  (80, 1283767346)   -- mik3          (2010-09-06)
) AS v(user_id, da)
WHERE l.id = v.user_id;

-- ── 3. Rebuild get_legacy_user_equivalence using date_added ───────────────

DROP FUNCTION IF EXISTS get_legacy_user_equivalence();
CREATE OR REPLACE FUNCTION get_legacy_user_equivalence()
RETURNS TABLE (
  legacy_user_id integer,
  legacy_username text,
  profile_id uuid,
  matched_by text,
  action text,
  current_username text,
  legacy_created_at timestamptz,
  current_created_at timestamptz,
  next_created_at timestamptz,
  current_email text,
  legacy_email text,
  next_email text,
  current_profile_image_url text,
  legacy_profile_image_url text,
  next_profile_image_url text,
  current_signature text,
  legacy_signature text,
  next_signature text,
  current_hide_email boolean,
  legacy_hide_email boolean,
  next_hide_email boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM assert_is_admin();

  RETURN QUERY
  WITH normalized_legacy AS (
    SELECT
      l.id AS legacy_user_id,
      btrim(l.username) AS legacy_username,
      CASE WHEN COALESCE(l.date_added, 0) > 0
        THEN to_timestamp(l.date_added)
        ELSE NULL
      END AS legacy_created_at,
      legacy_normalize_email(l.email) AS legacy_email,
      legacy_normalize_http_url(l.image) AS legacy_profile_image_url,
      legacy_normalize_nonempty(l.signature) AS legacy_signature,
      COALESCE(l.hide_email, false) AS legacy_hide_email
    FROM legacy_forum_auth_import l
    WHERE btrim(COALESCE(l.username, '')) <> ''
  ),
  matched AS (
    SELECT
      nl.*,
      mp.id AS profile_id,
      mp.username AS current_username,
      mp.created_at AS current_created_at,
      mp.profile_image_url AS current_profile_image_url,
      mp.signature AS current_signature,
      COALESCE(mp.hide_email, false) AS current_hide_email,
      au.email AS current_email
    FROM normalized_legacy nl
    LEFT JOIN LATERAL (
      SELECT p.id, p.username, p.created_at, p.profile_image_url, p.signature, p.hide_email
      FROM profiles p
      WHERE lower(p.username) = lower(nl.legacy_username)
      ORDER BY
        CASE WHEN p.username = nl.legacy_username THEN 0 ELSE 1 END,
        p.created_at ASC
      LIMIT 1
    ) mp ON true
    LEFT JOIN auth.users au ON au.id = mp.id
  )
  SELECT
    m.legacy_user_id,
    m.legacy_username,
    m.profile_id,
    CASE
      WHEN m.profile_id IS NULL THEN 'unmatched'
      WHEN m.current_username = m.legacy_username THEN 'username_exact'
      ELSE 'username_case_insensitive'
    END AS matched_by,
    CASE
      WHEN m.profile_id IS NULL THEN 'create_needed'
      ELSE 'update_existing'
    END AS action,
    m.current_username,
    m.legacy_created_at,
    m.current_created_at,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_created_at
      ELSE COALESCE(m.legacy_created_at, m.current_created_at)
    END AS next_created_at,
    m.current_email,
    m.legacy_email,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_email
      WHEN legacy_normalize_nonempty(m.current_email) IS NOT NULL THEN m.current_email
      ELSE m.legacy_email
    END AS next_email,
    m.current_profile_image_url,
    m.legacy_profile_image_url,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_profile_image_url
      WHEN legacy_normalize_nonempty(m.current_profile_image_url) IS NOT NULL THEN m.current_profile_image_url
      ELSE m.legacy_profile_image_url
    END AS next_profile_image_url,
    m.current_signature,
    m.legacy_signature,
    CASE
      WHEN m.profile_id IS NULL THEN m.legacy_signature
      WHEN legacy_normalize_nonempty(m.current_signature) IS NOT NULL THEN m.current_signature
      ELSE m.legacy_signature
    END AS next_signature,
    m.current_hide_email,
    m.legacy_hide_email,
    CASE
      WHEN m.legacy_hide_email THEN true
      ELSE m.current_hide_email
    END AS next_hide_email
  FROM matched m
  ORDER BY m.legacy_user_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION get_legacy_user_equivalence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_legacy_user_equivalence() TO authenticated;

-- ── 4. Rebuild apply_legacy_user_import to also write created_at ──────────

DROP FUNCTION IF EXISTS apply_legacy_user_import();
CREATE OR REPLACE FUNCTION apply_legacy_user_import()
RETURNS TABLE (
  legacy_user_id integer,
  profile_id uuid,
  action text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_item RECORD;
BEGIN
  PERFORM assert_is_admin();

  FOR row_item IN
    SELECT *
    FROM get_legacy_user_equivalence()
    ORDER BY legacy_user_id
  LOOP
    IF row_item.action = 'update_existing' THEN
      UPDATE profiles
      SET
        legacy_forum_user_id = row_item.legacy_user_id,
        created_at = COALESCE(row_item.legacy_created_at, created_at),
        profile_image_url = CASE
          WHEN legacy_normalize_nonempty(profile_image_url) IS NOT NULL THEN profile_image_url
          ELSE row_item.legacy_profile_image_url
        END,
        signature = CASE
          WHEN legacy_normalize_nonempty(signature) IS NOT NULL THEN signature
          ELSE row_item.legacy_signature
        END,
        hide_email = CASE
          WHEN row_item.legacy_hide_email THEN true
          ELSE hide_email
        END
      WHERE id = row_item.profile_id;

      -- Keep existing new-forum email if present; only backfill when missing.
      IF row_item.legacy_email IS NOT NULL
         AND legacy_normalize_nonempty(row_item.current_email) IS NULL THEN
        UPDATE auth.users
        SET
          email = row_item.legacy_email,
          email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE id = row_item.profile_id;
      END IF;

      legacy_user_id := row_item.legacy_user_id;
      profile_id := row_item.profile_id;
      action := 'updated_existing';
      RETURN NEXT;
    ELSE
      legacy_user_id := row_item.legacy_user_id;
      profile_id := NULL;
      action := 'create_needed';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION apply_legacy_user_import() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_legacy_user_import() TO authenticated;
