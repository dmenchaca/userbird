/*
  # Add team member assignment functionality
  
  1. Changes
    - Add `assignee_id` column to the `feedback` table
      - UUID, nullable
      - References auth.users(id)
    - Create index for faster lookups by assignee
    
  This allows feedback to be assigned to specific team members.
*/

-- Add assignee_id column to feedback table
ALTER TABLE feedback 
  ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id);

-- Create index for faster filtering by assignee
CREATE INDEX IF NOT EXISTS idx_feedback_assignee_id ON feedback(assignee_id);

-- Grant permissions to authenticated users to update the assignee
GRANT UPDATE (assignee_id) ON feedback TO authenticated;

-- No need to update RLS policies as the existing policies for UPDATE already cover this new column
-- Form owners, admin collaborators, and agent collaborators can all assign feedback based on their existing permissions 