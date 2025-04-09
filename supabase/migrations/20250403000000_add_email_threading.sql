/*
  Add columns for email threading to feedback_replies table:
  - message_id: Stores the Message-ID of the sent email for tracking
  - in_reply_to: Stores the Message-ID of the email being replied to
*/

-- Check if feedback_replies table exists before altering it
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_replies') THEN
    -- Add message_id column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback_replies' AND column_name = 'message_id') THEN
      ALTER TABLE feedback_replies ADD COLUMN message_id TEXT;
    END IF;
    
    -- Add in_reply_to column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback_replies' AND column_name = 'in_reply_to') THEN
      ALTER TABLE feedback_replies ADD COLUMN in_reply_to TEXT;
    END IF;
    
    -- Add indexes if they don't exist
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'feedback_replies' AND indexname = 'idx_feedback_replies_message_id') THEN
      CREATE INDEX idx_feedback_replies_message_id ON feedback_replies(message_id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'feedback_replies' AND indexname = 'idx_feedback_replies_in_reply_to') THEN
      CREATE INDEX idx_feedback_replies_in_reply_to ON feedback_replies(in_reply_to);
    END IF;
  END IF;
END $$; 