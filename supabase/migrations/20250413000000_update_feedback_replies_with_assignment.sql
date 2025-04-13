/*
  # Update feedback_replies to support assignment events
  
  This migration adds new columns to the feedback_replies table to support
  tracking assignment events alongside normal replies:
  
  1. New Columns:
    - `type` (text, with default 'reply') - The type of entry ('reply', 'assignment', etc.)
    - `assigned_to` (uuid, nullable) - User ID the feedback is assigned to
    - `assigned_by` (uuid, nullable) - User ID who made the assignment
    - `meta` (jsonb, nullable) - Flexible container for additional metadata
*/

-- Add type column with default 'reply'
ALTER TABLE feedback_replies ADD COLUMN IF NOT EXISTS 
  type TEXT NOT NULL DEFAULT 'reply';

-- Add comment explaining the type column
COMMENT ON COLUMN feedback_replies.type IS 
  'Type of entry (reply, assignment, note, status_change, etc.)';

-- Add assigned_to column
ALTER TABLE feedback_replies ADD COLUMN IF NOT EXISTS 
  assigned_to UUID;

-- Add comment explaining the assigned_to column
COMMENT ON COLUMN feedback_replies.assigned_to IS 
  'ID of the user the feedback is assigned to (for assignment events)';

-- Add assigned_by column
ALTER TABLE feedback_replies ADD COLUMN IF NOT EXISTS 
  assigned_by UUID;

-- Add comment explaining the assigned_by column
COMMENT ON COLUMN feedback_replies.assigned_by IS 
  'ID of the admin or system who made the assignment';

-- Add meta column for flexible metadata storage
ALTER TABLE feedback_replies ADD COLUMN IF NOT EXISTS 
  meta JSONB;

-- Add comment explaining the meta column
COMMENT ON COLUMN feedback_replies.meta IS 
  'Flexible container for additional metadata (e.g., status changes, assignment source)';

-- Make content nullable since assignment events don't require it
ALTER TABLE feedback_replies ALTER COLUMN content DROP NOT NULL; 