-- Add optional 0..N tags for topics while keeping category_id as the primary classification.
-- Backward-compatible: no changes to existing topics/category relations.

CREATE TABLE IF NOT EXISTS tags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tags_name_length CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 64),
  CONSTRAINT tags_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- Prevent duplicate tags with different casing/whitespace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_normalized_unique
  ON tags ((lower(btrim(name))));

CREATE INDEX IF NOT EXISTS idx_tags_created_at
  ON tags (created_at DESC);

CREATE TABLE IF NOT EXISTS topic_tags (
  topic_id bigint NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (topic_id, tag_id)
);

-- Reverse lookup: list topics by tag quickly.
CREATE INDEX IF NOT EXISTS idx_topic_tags_tag_topic
  ON topic_tags (tag_id, topic_id);

-- Topic detail lookup: list tags for one topic quickly.
CREATE INDEX IF NOT EXISTS idx_topic_tags_topic_created_at
  ON topic_tags (topic_id, created_at DESC);

-- Backfill tags from existing categories.
-- category_id remains the canonical required classification; tags are additive.
INSERT INTO tags (name, slug)
SELECT c.name, c.slug
FROM categories c
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name;

-- Backfill topic-tag links from each topic's current category.
-- One topic gets at least its category-equivalent tag; future extra tags are optional.
INSERT INTO topic_tags (topic_id, tag_id, created_by)
SELECT t.id, tg.id, t.author_id
FROM topics t
JOIN categories c ON c.id = t.category_id
JOIN tags tg ON tg.slug = c.slug
ON CONFLICT (topic_id, tag_id) DO NOTHING;

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_authenticated" ON tags;
CREATE POLICY "tags_select_authenticated"
  ON tags
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tags_insert_admin" ON tags;
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

DROP POLICY IF EXISTS "tags_update_admin" ON tags;
CREATE POLICY "tags_update_admin"
  ON tags
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );

DROP POLICY IF EXISTS "tags_delete_admin" ON tags;
CREATE POLICY "tags_delete_admin"
  ON tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_admin, false) = true
    )
  );

DROP POLICY IF EXISTS "topic_tags_select_authenticated" ON topic_tags;
CREATE POLICY "topic_tags_select_authenticated"
  ON topic_tags
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "topic_tags_insert_topic_owner" ON topic_tags;
CREATE POLICY "topic_tags_insert_topic_owner"
  ON topic_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      EXISTS (
        SELECT 1
        FROM topics t
        WHERE t.id = topic_tags.topic_id
          AND t.author_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND COALESCE(p.is_admin, false) = true
      )
    )
  );

DROP POLICY IF EXISTS "topic_tags_delete_topic_owner" ON topic_tags;
CREATE POLICY "topic_tags_delete_topic_owner"
  ON topic_tags
  FOR DELETE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM topics t
        WHERE t.id = topic_tags.topic_id
          AND t.author_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid()
          AND COALESCE(p.is_admin, false) = true
      )
    )
  );
