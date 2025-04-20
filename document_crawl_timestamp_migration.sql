-- Migration to update document crawl timestamps

-- 1. First ensure the crawl_timestamp column exists
DO $$
BEGIN
  IF NOT EXISTS(SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='documents' AND column_name='crawl_timestamp') THEN
    ALTER TABLE documents ADD COLUMN crawl_timestamp TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Add an index on crawl_timestamp to improve query performance
CREATE INDEX IF NOT EXISTS documents_crawl_timestamp_idx ON documents(crawl_timestamp);

-- 3. Create a function to copy the timestamp from scraping process to documents
CREATE OR REPLACE FUNCTION sync_document_crawl_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Set the crawl_timestamp on the new document to match the scraping process's created_at
  IF NEW.scraping_process_id IS NOT NULL THEN
    SELECT created_at INTO NEW.crawl_timestamp
    FROM docs_scraping_processes
    WHERE id = NEW.scraping_process_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create a trigger to automatically set crawl_timestamp when a document is created
DROP TRIGGER IF EXISTS set_document_crawl_timestamp ON documents;
CREATE TRIGGER set_document_crawl_timestamp
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION sync_document_crawl_timestamp();

-- 5. Backfill existing documents with correct crawl_timestamp values
UPDATE documents d
SET crawl_timestamp = p.created_at
FROM docs_scraping_processes p
WHERE (d.metadata->>'process_id')::text = p.id::text
  AND (d.crawl_timestamp IS NULL OR d.crawl_timestamp != p.created_at);

-- 6. Create a function to find the latest scraping process for a form
CREATE OR REPLACE FUNCTION get_latest_scraping_process_id(form_id_param UUID)
RETURNS UUID AS $$
DECLARE
  latest_process_id UUID;
BEGIN
  SELECT id INTO latest_process_id
  FROM docs_scraping_processes
  WHERE form_id = form_id_param
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN latest_process_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Create a function to find all documents from the latest scraping process
CREATE OR REPLACE FUNCTION get_documents_from_latest_scraping(form_id_param UUID)
RETURNS SETOF documents AS $$
DECLARE
  latest_timestamp TIMESTAMPTZ;
BEGIN
  -- Find the timestamp of the latest completed scraping process
  SELECT created_at INTO latest_timestamp
  FROM docs_scraping_processes
  WHERE form_id = form_id_param
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Return all documents with matching crawl_timestamp
  RETURN QUERY
  SELECT d.*
  FROM documents d
  WHERE d.form_id = form_id_param
    AND d.crawl_timestamp = latest_timestamp;
END;
$$ LANGUAGE plpgsql; 