/*
  # Add feedback status field
  
  1. Changes
    - Add `status` column to the `feedback` table
      - Default value: 'open'
      - Possible values: 'open' or 'closed'
    - Create an enum type for status values
    
  This allows tracking whether submitted feedback has been addressed or not.
*/

-- Create enum type for status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_status_enum') THEN
    CREATE TYPE feedback_status_enum AS ENUM ('open', 'closed');
  END IF;
END $$;

-- Add status column to feedback table
ALTER TABLE feedback 
  ADD COLUMN IF NOT EXISTS status feedback_status_enum NOT NULL DEFAULT 'open';

-- Create index for faster filtering by status
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);

-- Update existing policies to maintain access
DROP POLICY IF EXISTS "Allow public feedback status update" ON feedback;

CREATE POLICY "Allow public feedback status update"
  ON feedback
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true); 