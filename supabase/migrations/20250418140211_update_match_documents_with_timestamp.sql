-- Drop the existing function
DROP FUNCTION IF EXISTS match_documents;

-- Re-create function with crawl_timestamp filtering options
CREATE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT NULL,
  filter jsonb DEFAULT '{}',
  form_id_filter text DEFAULT NULL,
  specific_timestamp timestamptz DEFAULT NULL,
  use_latest_crawl boolean DEFAULT true
) RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  form_id text,
  crawl_timestamp timestamptz
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  latest_ts timestamptz;
BEGIN
  -- If use_latest_crawl is true and no specific timestamp is provided,
  -- find the latest crawl timestamp for the form (or all forms if form_id_filter is NULL)
  IF use_latest_crawl AND specific_timestamp IS NULL THEN
    IF form_id_filter IS NOT NULL THEN
      -- Get latest timestamp for specific form
      SELECT MAX(crawl_timestamp) INTO latest_ts
      FROM documents
      WHERE form_id = form_id_filter;
    ELSE
      -- Get latest timestamp across all forms
      SELECT MAX(crawl_timestamp) INTO latest_ts
      FROM documents;
    END IF;
  ELSE
    -- Use the provided timestamp
    latest_ts := specific_timestamp;
  END IF;

  -- Run the query with all filters
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity,
    documents.form_id,
    documents.crawl_timestamp
  FROM documents
  WHERE 
    metadata @> filter
    AND (form_id_filter IS NULL OR form_id = form_id_filter)
    AND (
      (use_latest_crawl AND latest_ts IS NOT NULL AND crawl_timestamp = latest_ts) OR
      (specific_timestamp IS NOT NULL AND crawl_timestamp = specific_timestamp) OR
      (NOT use_latest_crawl AND specific_timestamp IS NULL)
    )
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 