/*
  # Drop assigned_by column after renaming to sender_id
  
  This migration removes the old assigned_by column from the feedback_replies table
  to avoid confusion after renaming it to sender_id.
  
  This ensures a clean schema with consistent naming:
  - sender_id: Who performed the action
  - sender_type: What role they had (admin, user, system)
  - assigned_to: Who received the assignment (only for type = 'assignment')
*/

-- First check if the assigned_by column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback_replies' 
    AND column_name = 'assigned_by'
  ) THEN
    -- Drop the old assigned_by column since we've renamed it to sender_id
    ALTER TABLE feedback_replies DROP COLUMN assigned_by;
  END IF;

  -- Drop any foreign key constraints to avoid PostgREST issues
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'feedback_replies'
    AND column_name = 'sender_id'
    AND constraint_name LIKE 'feedback_replies_sender_id_fkey%'
  ) THEN
    ALTER TABLE feedback_replies DROP CONSTRAINT feedback_replies_sender_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'feedback_replies'
    AND column_name = 'assigned_to'
    AND constraint_name LIKE 'feedback_replies_assigned_to_fkey%'
  ) THEN
    ALTER TABLE feedback_replies DROP CONSTRAINT feedback_replies_assigned_to_fkey;
  END IF;
END $$; 