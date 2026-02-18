-- Manual approval workflow for new members

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_approval_status_chk'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_approval_status_chk
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END
$$;

-- Existing users are approved by default
UPDATE profiles
SET approval_status = 'approved'
WHERE approval_status IS NULL OR approval_status = 'pending';

DROP FUNCTION IF EXISTS set_profile_approval_status(uuid, text);
CREATE OR REPLACE FUNCTION set_profile_approval_status(target_user_id uuid, new_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_caller_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.is_admin INTO is_caller_admin
  FROM profiles p
  WHERE p.id = auth.uid();

  IF COALESCE(is_caller_admin, false) = false THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF new_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid approval status';
  END IF;

  UPDATE profiles
  SET approval_status = new_status
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION set_profile_approval_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_profile_approval_status(uuid, text) TO authenticated;
