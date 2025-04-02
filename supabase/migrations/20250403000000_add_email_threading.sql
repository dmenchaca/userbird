/*
  Add columns for email threading to feedback_replies table:
  - message_id: Stores the Message-ID of the sent email for tracking
  - in_reply_to: Stores the Message-ID of the email being replied to
*/

-- Add message_id column
ALTER TABLE feedback_replies 
ADD COLUMN message_id TEXT;

-- Add in_reply_to column
ALTER TABLE feedback_replies 
ADD COLUMN in_reply_to TEXT;

-- Add indexes for faster lookups
CREATE INDEX idx_feedback_replies_message_id ON feedback_replies(message_id);
CREATE INDEX idx_feedback_replies_in_reply_to ON feedback_replies(in_reply_to); 