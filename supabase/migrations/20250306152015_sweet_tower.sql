/*
  # Add URL path tracking
  
  1. Changes
    - Add `url_path` column to feedback table to track the page path where feedback was submitted
    
  2. Notes
    - Column is nullable since existing records won't have this data
    - Text type allows for long URLs and query parameters
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback' AND column_name = 'url_path'
  ) THEN
    ALTER TABLE feedback ADD COLUMN url_path text;
  END IF;
END $$;