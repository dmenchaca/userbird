/*
  # Add favorite flag to tags
  
  1. Changes
    - Add `is_favorite` column to the `feedback_tags` table
      - Default value: false
    
  This allows users to mark certain tags as favorites for quicker access.
*/

DO $$ 
BEGIN
  -- Check if feedback_tags table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_tags') THEN
    -- Add is_favorite column to feedback_tags table
    ALTER TABLE feedback_tags 
      ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

    -- Create index for faster filtering by favorite status
    CREATE INDEX IF NOT EXISTS idx_feedback_tags_favorite ON feedback_tags(is_favorite);

    -- Update existing global tags to be favorites by default
    UPDATE feedback_tags 
    SET is_favorite = true 
    WHERE form_id IS NULL;
  END IF;
END $$; 