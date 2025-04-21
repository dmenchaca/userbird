/*
  # Update match_documents function to stop using is_current
  
  1. Changes
    - Remove is_current filter from match_documents function
    - Update function comment to reflect the change
    - Add a migration comment
*/

-- Update the match_documents function to remove is_current filter
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

  -- Run the query with all filters, removing the is_current filter
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
$function$;

-- Update the function comment
COMMENT ON FUNCTION public.match_documents IS 'Matches document embeddings against a query embedding, filtering by form_id and timestamps. Uses crawl_timestamp to manage document versioning.'; 