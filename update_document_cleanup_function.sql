/*
  # Update document cleanup function to use timestamps instead of is_current
  
  1. Changes
    - Create a new function to clean up outdated documents using crawl_timestamp
    - This function will delete documents that are older than the latest document
      for each form_id, preserving only the most recent crawl data
*/

CREATE OR REPLACE FUNCTION cleanup_outdated_documents(retention_days integer DEFAULT 30)
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Step 1: Find the latest crawl_timestamp for each form_id
  WITH latest_crawls AS (
    SELECT form_id, MAX(crawl_timestamp) AS latest_timestamp
    FROM documents
    GROUP BY form_id
  ),
  
  -- Step 2: Delete documents that are not from the latest crawl and older than retention_days
  deleted AS (
    DELETE FROM documents d
    WHERE EXISTS (
      SELECT 1 FROM latest_crawls lc
      WHERE lc.form_id = d.form_id
      AND d.crawl_timestamp < lc.latest_timestamp
      AND d.crawl_timestamp < (NOW() - (retention_days * INTERVAL '1 day'))
    )
    RETURNING *
  )
  
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to explain the function
COMMENT ON FUNCTION cleanup_outdated_documents IS 'Cleans up outdated documents by deleting those that are from older crawls and beyond the retention period.';

-- Notice regarding the cleanup-old-documents function
DO $$
BEGIN
  RAISE NOTICE 'NOTE: The netlify/functions/cleanup-old-documents function should be updated to use this new database function.';
END $$; 