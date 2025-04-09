/*
  Add html_content column to feedback_replies table to store rich formatted content:
  - html_content: Stores the sanitized HTML version of the reply
*/

-- Check if feedback_replies table exists before altering it
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_replies') THEN
    -- Add html_content column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'feedback_replies' AND column_name = 'html_content') THEN
      ALTER TABLE feedback_replies ADD COLUMN html_content TEXT;
      
      -- Backfill existing entries (this will set html_content to content, but will be plain text)
      UPDATE feedback_replies
      SET html_content = content
      WHERE html_content IS NULL;
      
      COMMENT ON COLUMN feedback_replies.html_content IS 'Sanitized HTML content of the reply, including links and formatting';
    END IF;
  END IF;
END $$; 