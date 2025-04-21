-- Add similarity threshold parameter to match_documents function
-- This migration adds a similarity_threshold parameter to filter out less relevant documents
-- and helps prevent token limit issues when sending to OpenAI

-- Drop the existing function
DROP FUNCTION IF EXISTS match_documents;

-- Re-create function with similarity_threshold parameter
CREATE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT NULL,
  filter jsonb DEFAULT '{}',
  form_id_filter text DEFAULT NULL,
  specific_timestamp timestamptz DEFAULT NULL,
  use_latest_crawl boolean DEFAULT true,
  similarity_threshold float DEFAULT 0.0  -- New parameter with default 0.0 (no filtering)
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

  -- Run the query with all filters and add similarity threshold
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
    AND (1 - (documents.embedding <=> query_embedding)) >= similarity_threshold  -- New similarity threshold filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update function comment to include the new parameter
COMMENT ON FUNCTION public.match_documents IS 'Matches document embeddings against a query embedding, filtering by form_id, timestamps, and similarity threshold. Returns only documents with similarity scores above the threshold.'; 