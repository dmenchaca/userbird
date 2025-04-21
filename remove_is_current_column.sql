-- Migration to remove the is_current column from documents table

-- First, drop the trigger that depends on is_current
DROP TRIGGER IF EXISTS ensure_single_current_document ON documents;

-- Also drop the trigger function if it exists
DROP FUNCTION IF EXISTS maintain_single_current_document();

-- Then check if the column exists before attempting to drop it
DO $$
BEGIN
  IF EXISTS(SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='documents' AND column_name='is_current') THEN
    -- Drop the column if it exists
    ALTER TABLE documents DROP COLUMN is_current;
    
    -- Log message
    RAISE NOTICE 'The is_current column has been removed from the documents table';
  ELSE
    -- Log message if the column doesn't exist
    RAISE NOTICE 'The is_current column does not exist in the documents table';
  END IF;
END $$;

-- Remove any indexes that might have been created for is_current
DROP INDEX IF EXISTS idx_documents_is_current;

-- Add a comment to the migration for documentation
COMMENT ON TABLE documents IS 'Stores document chunks with embeddings for AI retrieval. Documents are associated with forms and may include metadata such as source URL and title.'; 