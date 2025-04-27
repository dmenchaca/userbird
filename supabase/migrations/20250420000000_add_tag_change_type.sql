/*
  # Add tag_change type documentation
  
  This migration adds a COMMENT to document the 'tag_change' type
  in the feedback_replies.type column.
  
  This is used to track when tags are added, changed, or removed from feedback.
*/

-- Update the comment on the type column
COMMENT ON COLUMN feedback_replies.type IS 
  'Type of entry (reply, assignment, note, status_change, tag_change, etc.)'; 