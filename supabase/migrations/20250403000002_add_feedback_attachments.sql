/*
  Create attachments table for email messages, but only if feedback_replies table exists
*/

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_replies') THEN
    -- Create feedback_attachments table only if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_attachments') THEN
      -- Create feedback_attachments table to store email attachment metadata, including inline images
      CREATE TABLE IF NOT EXISTS feedback_attachments (
        id UUID PRIMARY KEY,
        reply_id UUID REFERENCES feedback_replies(id),
        filename TEXT NOT NULL,
        content_id TEXT,
        content_type TEXT NOT NULL,
        url TEXT NOT NULL,
        is_inline BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
      );
      
      -- Add an index on reply_id for faster lookups when fetching all attachments for a reply
      CREATE INDEX IF NOT EXISTS feedback_attachments_reply_id_idx ON feedback_attachments(reply_id);
      
      -- Add an index on content_id for faster lookups when replacing cid references
      CREATE INDEX IF NOT EXISTS feedback_attachments_content_id_idx ON feedback_attachments(content_id);
      
      -- Comment explaining the table and its purpose
      COMMENT ON TABLE feedback_attachments IS 'Stores attachment metadata for email replies, including inline images referenced in HTML content';
      
      -- Add appropriate RLS policies
      ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;
      
      -- Allow public access to read attachments (matches the feedback_replies policy)
      CREATE POLICY "Allow public attachment reading"
        ON feedback_attachments
        FOR SELECT
        TO public
        USING (true);
      
      -- Policy to allow service role to insert attachments
      CREATE POLICY "Service role can insert attachments" ON feedback_attachments
        FOR INSERT WITH CHECK (true);
    END IF;
  END IF;
END $$; 