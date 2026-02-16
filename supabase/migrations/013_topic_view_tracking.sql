-- Thread view tracking: total hits + unique viewers in a time window

ALTER TABLE topics ADD COLUMN IF NOT EXISTS views_total bigint DEFAULT 0;
ALTER TABLE topics ADD COLUMN IF NOT EXISTS views_unique bigint DEFAULT 0;

-- Keep existing data meaningful on migration
UPDATE topics
SET
  views_total = GREATEST(COALESCE(views_total, 0), COALESCE(views, 0)),
  views_unique = GREATEST(COALESCE(views_unique, 0), COALESCE(views, 0));

CREATE TABLE IF NOT EXISTS topic_view_events (
  topic_id bigint NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  viewer_key text NOT NULL,
  last_viewed_at timestamptz NOT NULL DEFAULT now(),
  total_views bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (topic_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_topic_view_events_last_viewed_at
  ON topic_view_events(last_viewed_at DESC);

ALTER TABLE topic_view_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION record_topic_view(
  target_topic_id bigint,
  custom_viewer_key text DEFAULT NULL,
  unique_window_seconds integer DEFAULT 86400
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_viewer_key text;
  previous_view_at timestamptz;
  should_increment_unique boolean := false;
  current_total bigint;
  current_unique bigint;
BEGIN
  IF target_topic_id IS NULL THEN
    RAISE EXCEPTION 'Topic id is required';
  END IF;

  IF auth.uid() IS NULL AND (custom_viewer_key IS NULL OR length(trim(custom_viewer_key)) = 0) THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  effective_viewer_key := COALESCE(NULLIF(trim(custom_viewer_key), ''), auth.uid()::text);

  -- Count every hit in total view counters
  UPDATE topics
  SET
    views_total = COALESCE(views_total, 0) + 1,
    views = COALESCE(views, 0) + 1
  WHERE id = target_topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Topic not found';
  END IF;

  -- Unique counting with cooldown per (topic, viewer_key)
  SELECT last_viewed_at INTO previous_view_at
  FROM topic_view_events
  WHERE topic_id = target_topic_id
    AND viewer_key = effective_viewer_key
  FOR UPDATE;

  IF previous_view_at IS NULL THEN
    BEGIN
      INSERT INTO topic_view_events (topic_id, viewer_key, last_viewed_at, total_views)
      VALUES (target_topic_id, effective_viewer_key, now(), 1);

      should_increment_unique := true;
    EXCEPTION WHEN unique_violation THEN
      SELECT last_viewed_at INTO previous_view_at
      FROM topic_view_events
      WHERE topic_id = target_topic_id
        AND viewer_key = effective_viewer_key
      FOR UPDATE;

      UPDATE topic_view_events
      SET
        total_views = total_views + 1,
        last_viewed_at = now()
      WHERE topic_id = target_topic_id
        AND viewer_key = effective_viewer_key;

      should_increment_unique := previous_view_at <= now() - make_interval(secs => GREATEST(unique_window_seconds, 0));
    END;
  ELSE
    UPDATE topic_view_events
    SET
      total_views = total_views + 1,
      last_viewed_at = now()
    WHERE topic_id = target_topic_id
      AND viewer_key = effective_viewer_key;

    should_increment_unique := previous_view_at <= now() - make_interval(secs => GREATEST(unique_window_seconds, 0));
  END IF;

  IF should_increment_unique THEN
    UPDATE topics
    SET views_unique = COALESCE(views_unique, 0) + 1
    WHERE id = target_topic_id;
  END IF;

  SELECT COALESCE(views_total, 0), COALESCE(views_unique, 0)
  INTO current_total, current_unique
  FROM topics
  WHERE id = target_topic_id;

  RETURN jsonb_build_object(
    'views_total', current_total,
    'views_unique', current_unique,
    'counted_unique', should_increment_unique
  );
END;
$$;

REVOKE ALL ON FUNCTION record_topic_view(bigint, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_topic_view(bigint, text, integer) TO authenticated;
