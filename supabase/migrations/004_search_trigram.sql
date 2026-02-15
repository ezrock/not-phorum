-- Enable pg_trgm extension for fuzzy/typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes for fast similarity lookups
CREATE INDEX IF NOT EXISTS idx_topics_title_trgm ON topics USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm ON posts USING GIN (content gin_trgm_ops);

-- Unified search function across topics and posts
CREATE OR REPLACE FUNCTION search_forum(search_term text, result_limit int DEFAULT 20)
RETURNS TABLE (
  result_type text,
  topic_id bigint,
  topic_title text,
  content_snippet text,
  category_name text,
  category_icon text,
  author_username text,
  author_avatar text,
  author_profile_image_url text,
  similarity_score real,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY

  -- Search topic titles
  SELECT
    'topic'::text AS result_type,
    t.id AS topic_id,
    t.title AS topic_title,
    NULL::text AS content_snippet,
    c.name AS category_name,
    c.icon AS category_icon,
    p.username AS author_username,
    p.avatar AS author_avatar,
    p.profile_image_url AS author_profile_image_url,
    similarity(t.title, search_term) AS similarity_score,
    t.created_at
  FROM topics t
  JOIN categories c ON c.id = t.category_id
  JOIN profiles p ON p.id = t.author_id
  WHERE similarity(t.title, search_term) > 0.1
     OR t.title ILIKE '%' || search_term || '%'

  UNION ALL

  -- Search post content
  SELECT
    'post'::text AS result_type,
    po.topic_id,
    t.title AS topic_title,
    LEFT(po.content, 200) AS content_snippet,
    c.name AS category_name,
    c.icon AS category_icon,
    pr.username AS author_username,
    pr.avatar AS author_avatar,
    pr.profile_image_url AS author_profile_image_url,
    similarity(po.content, search_term) AS similarity_score,
    po.created_at
  FROM posts po
  JOIN topics t ON t.id = po.topic_id
  JOIN categories c ON c.id = t.category_id
  JOIN profiles pr ON pr.id = po.author_id
  WHERE similarity(po.content, search_term) > 0.1
     OR po.content ILIKE '%' || search_term || '%'

  ORDER BY similarity_score DESC, created_at DESC
  LIMIT result_limit;
END;
$$;
