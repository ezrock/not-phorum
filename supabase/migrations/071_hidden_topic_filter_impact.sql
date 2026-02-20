-- Impact summary for hidden topic filters in profile settings.

DROP FUNCTION IF EXISTS get_hidden_topic_filter_impact(bigint[], bigint[]);
CREATE OR REPLACE FUNCTION get_hidden_topic_filter_impact(
  input_hidden_tag_ids bigint[] DEFAULT NULL,
  input_hidden_tag_group_ids bigint[] DEFAULT NULL
)
RETURNS TABLE (
  hidden_topic_count bigint,
  total_topic_count bigint,
  hidden_message_count bigint,
  total_message_count bigint,
  hidden_message_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_hidden_tag_ids bigint[] := resolve_canonical_tag_ids(input_hidden_tag_ids);
  normalized_hidden_tag_group_ids bigint[] := COALESCE(input_hidden_tag_group_ids, ARRAY[]::bigint[]);
  hidden_group_member_tag_ids bigint[] := ARRAY[]::bigint[];
  normalized_excluded_tag_ids bigint[] := ARRAY[]::bigint[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF COALESCE(array_length(normalized_hidden_tag_group_ids, 1), 0) > 0 THEN
    SELECT resolve_canonical_tag_ids(array_agg(tgm.tag_id))
    INTO hidden_group_member_tag_ids
    FROM tag_group_members tgm
    WHERE tgm.group_id = ANY(normalized_hidden_tag_group_ids);
  END IF;

  SELECT COALESCE(array_agg(DISTINCT source.tag_id), ARRAY[]::bigint[])
  INTO normalized_excluded_tag_ids
  FROM unnest(
    array_cat(
      COALESCE(normalized_hidden_tag_ids, ARRAY[]::bigint[]),
      COALESCE(hidden_group_member_tag_ids, ARRAY[]::bigint[])
    )
  ) AS source(tag_id);

  RETURN QUERY
  WITH hidden_topics AS (
    SELECT DISTINCT tt.topic_id
    FROM topic_tags tt
    WHERE COALESCE(array_length(normalized_excluded_tag_ids, 1), 0) > 0
      AND tt.tag_id = ANY(normalized_excluded_tag_ids)
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*)::bigint FROM topics) AS total_topics,
      (SELECT COUNT(*)::bigint FROM hidden_topics) AS hidden_topics,
      (SELECT COUNT(*)::bigint FROM posts p WHERE p.deleted_at IS NULL) AS total_messages,
      (
        SELECT COUNT(*)::bigint
        FROM posts p
        JOIN hidden_topics ht ON ht.topic_id = p.topic_id
        WHERE p.deleted_at IS NULL
      ) AS hidden_messages
  )
  SELECT
    totals.hidden_topics,
    totals.total_topics,
    totals.hidden_messages,
    totals.total_messages,
    CASE
      WHEN totals.total_messages = 0 THEN 0::numeric
      ELSE ROUND((totals.hidden_messages::numeric / totals.total_messages::numeric) * 100.0, 1)
    END AS hidden_message_percent
  FROM totals;
END;
$$;

REVOKE ALL ON FUNCTION get_hidden_topic_filter_impact(bigint[], bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_hidden_topic_filter_impact(bigint[], bigint[]) TO authenticated;
