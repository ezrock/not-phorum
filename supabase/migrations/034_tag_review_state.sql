-- Add review workflow fields for tags.
-- Existing tags become approved + featured to keep current UX stable.

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_status_valid;
ALTER TABLE tags
  ADD CONSTRAINT tags_status_valid CHECK (status IN ('approved', 'unreviewed', 'rejected'));

UPDATE tags
SET status = 'approved',
    featured = true
WHERE status IS DISTINCT FROM 'approved'
   OR featured IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_tags_approved_featured_name
  ON tags (name)
  WHERE status = 'approved' AND featured = true;

CREATE INDEX IF NOT EXISTS idx_tags_approved_featured_slug
  ON tags (slug)
  WHERE status = 'approved' AND featured = true;

DROP POLICY IF EXISTS "tags_insert_admin" ON tags;
DROP POLICY IF EXISTS "tags_insert_authenticated_unreviewed" ON tags;
CREATE POLICY "tags_insert_authenticated_unreviewed"
  ON tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'unreviewed'
    AND featured = false
  );

CREATE POLICY "tags_insert_admin"
  ON tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );
