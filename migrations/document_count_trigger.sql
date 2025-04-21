-- Add document_count column to docs_scraping_processes
ALTER TABLE docs_scraping_processes ADD COLUMN IF NOT EXISTS document_count INTEGER DEFAULT 0;

-- Create a function to increment the document count for a process
CREATE OR REPLACE FUNCTION increment_document_count()
RETURNS TRIGGER AS $$
DECLARE
  process_id TEXT;
BEGIN
  -- Extract the process_id from the document metadata
  process_id := NEW.metadata->>'process_id';

  -- Only proceed if we have a process_id
  IF process_id IS NOT NULL THEN
    -- Increment the document_count for the corresponding process
    UPDATE docs_scraping_processes
    SET document_count = document_count + 1
    WHERE id = process_id;
  END IF;

  -- Return the inserted row (required for AFTER triggers)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run the function after a document is inserted
DROP TRIGGER IF EXISTS update_document_count ON documents;
CREATE TRIGGER update_document_count
AFTER INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION increment_document_count();

-- Create an index on metadata->process_id to speed up the trigger function
CREATE INDEX IF NOT EXISTS idx_documents_process_id ON documents USING GIN ((metadata->'process_id')); 