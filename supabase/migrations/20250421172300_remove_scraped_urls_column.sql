/*
  # Remove scraped_urls column and add URL export function
  
  1. Changes
    - Remove the scraped_urls column from docs_scraping_processes
    - Add a function to get all unique URLs for a process from documents
    - Update table comment to reflect changes
    
  2. Features
    - Streamlines the database schema
    - Provides a consistent way to export URLs
    - Uses the document table as the single source of truth
*/

-- First check if the column exists to avoid errors
DO $$
BEGIN
  IF EXISTS(SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='docs_scraping_processes' AND column_name='scraped_urls') THEN
    -- Remove the column
    ALTER TABLE docs_scraping_processes DROP COLUMN scraped_urls;
  END IF;
END $$;

-- Create a function to get all unique URLs for a specific process
CREATE OR REPLACE FUNCTION get_process_urls(process_id_param UUID)
RETURNS TABLE(url TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT metadata->>'url' as url
  FROM documents
  WHERE metadata->>'process_id' = process_id_param::TEXT
  ORDER BY url;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION get_process_urls IS 'Retrieves all unique URLs from documents associated with a specific scraping process';

-- Update table comment
COMMENT ON TABLE docs_scraping_processes IS 'Tracks document scraping processes for AI automation. Uses document crawl_timestamp for tracking completion.'; 