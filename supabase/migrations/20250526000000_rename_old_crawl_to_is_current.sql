/*
  # Rename old_crawl to is_current
  
  1. Changes
    - Rename old_crawl column to is_current 
    - Invert the boolean values (old_crawl=TRUE becomes is_current=FALSE)
    - Update index name
    - Update column comment
*/

-- If both columns exist, we need to decide which to keep
DO $$
BEGIN
  -- Check if both columns exist
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'old_crawl'
  ) AND EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'is_current'
  ) THEN
    -- Both columns exist, so drop is_current (the new one) and rename old_crawl
    ALTER TABLE documents DROP COLUMN is_current;
    
    -- Rename old_crawl to is_current and invert the value
    ALTER TABLE documents 
      RENAME COLUMN old_crawl TO is_current;
    
    -- Invert boolean values (NOT old_crawl)
    UPDATE documents 
    SET is_current = NOT is_current;
    
    -- Drop the old index if it exists
    DROP INDEX IF EXISTS idx_documents_old_crawl;
    
  -- If only old_crawl exists
  ELSIF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'old_crawl'
  ) THEN
    -- Rename old_crawl to is_current and invert the value
    ALTER TABLE documents 
      RENAME COLUMN old_crawl TO is_current;
    
    -- Invert boolean values (NOT old_crawl)
    UPDATE documents 
    SET is_current = NOT is_current;
    
    -- Drop the old index if it exists
    DROP INDEX IF EXISTS idx_documents_old_crawl;
  
  -- If only is_current exists, do nothing
  ELSE
    RAISE NOTICE 'Column is_current already exists, no renaming needed';
  END IF;
END $$;

-- Recreate index with correct name (in case it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_documents_is_current ON documents(is_current);

-- Update or add the comment
COMMENT ON COLUMN documents.is_current IS 'Flag indicating whether this document is from the current crawl of the same form_id. The match_documents function will only use documents where this is true.'; 