/*
  # Rename assigned_by to sender_id for more consistent data modeling
  
  This migration renames the assigned_by column to sender_id in the feedback_replies table.
  This creates a more consistent data model where:
  
  - sender_id: The user who performed the action
  - sender_type: The role or source they had (admin, user, system)
  - assigned_to: The user receiving the assignment (only used for type = 'assignment')
*/

-- Rename assigned_by column to sender_id
ALTER TABLE feedback_replies 
  RENAME COLUMN assigned_by TO sender_id;

-- Update the comment for the sender_id column
COMMENT ON COLUMN feedback_replies.sender_id IS 
  'ID of the user or system who performed this action';

-- Note: We're NOT adding foreign key constraints to auth.users
-- because this might cause problems with the Supabase PostgREST API
-- If a foreign key relationship is needed, we'll handle it in application code
-- This avoids the 400 errors when trying to join these tables
COMMENT ON COLUMN feedback_replies.sender_id IS 
  'References a user ID but without a formal foreign key constraint';
  
COMMENT ON COLUMN feedback_replies.assigned_to IS 
  'References a user ID but without a formal foreign key constraint'; 