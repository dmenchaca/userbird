/*
  # Add is_current flag to documents table
  
  1. Changes
    - Add is_current boolean column to documents table (default true)
    - Add index on is_current column for efficient filtering
    - Add comment explaining the purpose of the flag
*/

-- Add is_current column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT TRUE;

-- Add comment to explain the purpose
COMMENT ON COLUMN documents.is_current IS 'Flag indicating whether this document is from the current crawl of the same form_id. The match_documents function will only use documents where this is true.';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_documents_is_current ON documents(is_current);

-- Update the match_documents function to filter by is_current flag
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector, 
  match_count integer DEFAULT NULL::integer, 
  filter jsonb DEFAULT '{}'::jsonb, 
  form_id_filter text DEFAULT NULL::text, 
  specific_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  use_latest_crawl boolean DEFAULT true
)
RETURNS TABLE(
  id bigint, 
  content text, 
  metadata jsonb, 
  similarity double precision, 
  form_id text, 
  crawl_timestamp timestamp with time zone
)
LANGUAGE plpgsql
AS $function$
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

  -- Run the query with all filters, including is_current = TRUE
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
    AND is_current = TRUE -- Only use current documents
    AND (
      (use_latest_crawl AND latest_ts IS NOT NULL AND crawl_timestamp = latest_ts) OR
      (specific_timestamp IS NOT NULL AND crawl_timestamp = specific_timestamp) OR
      (NOT use_latest_crawl AND specific_timestamp IS NULL)
    )
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Add comment to the function explaining the is_current flag
COMMENT ON FUNCTION public.match_documents IS 'Matches document embeddings against a query embedding, filtering by form_id, timestamps, and is_current=TRUE. This ensures only current crawl data is returned.'; 