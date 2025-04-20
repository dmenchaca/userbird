/*
  # Add old_crawl flag to documents table
  
  1. Changes
    - Add old_crawl boolean column to documents table (default false)
    - Add index on old_crawl column for efficient filtering
    - Add comment explaining the purpose of the flag
*/

-- Add old_crawl column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS old_crawl BOOLEAN DEFAULT FALSE;

-- Add comment to explain the purpose
COMMENT ON COLUMN documents.old_crawl IS 'Flag indicating whether this document is from an outdated crawl of the same form_id. The match_documents function will filter out documents where this is true.';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_documents_old_crawl ON documents(old_crawl);

-- Update the match_documents function to filter by old_crawl flag
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

  -- Run the query with all filters, including old_crawl = FALSE
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
    AND old_crawl = FALSE -- Filter out documents marked as old
    AND (
      (use_latest_crawl AND latest_ts IS NOT NULL AND crawl_timestamp = latest_ts) OR
      (specific_timestamp IS NOT NULL AND crawl_timestamp = specific_timestamp) OR
      (NOT use_latest_crawl AND specific_timestamp IS NULL)
    )
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Add comment to the function explaining the old_crawl flag
COMMENT ON FUNCTION public.match_documents IS 'Matches document embeddings against a query embedding, filtering by form_id, timestamps, and old_crawl=FALSE. This ensures only current (non-outdated) crawl data is returned.'; 