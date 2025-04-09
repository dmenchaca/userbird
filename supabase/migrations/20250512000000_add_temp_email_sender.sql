/*
  # Add Temporary Email Sender Table
  
  This table is used as a communication bridge for custom email functionality
  - Stores sender information temporarily before it's used by the email service
  - Automatically clears old entries to maintain performance
*/

-- Create temp_email_sender table conditionally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'temp_email_sender'
  ) THEN
    -- Create the table
    CREATE TABLE temp_email_sender (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      sender_email text NOT NULL,
      sender_name text,
      created_at timestamptz DEFAULT now(),
      processed boolean DEFAULT false
    );

    -- Create index for faster lookups
    CREATE INDEX idx_temp_email_sender_feedback_id ON temp_email_sender(feedback_id);

    -- Enable Row Level Security
    ALTER TABLE temp_email_sender ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policy conditionally
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'temp_email_sender'
  ) AND NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'temp_email_sender'
    AND policyname = 'Service functions can manage temp_email_sender'
  ) THEN
    -- Create policy to allow internal services to use this table
    CREATE POLICY "Service functions can manage temp_email_sender"
    ON temp_email_sender
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Add cleanup function conditionally
DO $$
BEGIN
  -- Create or replace the function without trying to drop it first
  CREATE OR REPLACE FUNCTION cleanup_temp_email_sender()
  RETURNS TRIGGER AS $func$
  BEGIN
    DELETE FROM temp_email_sender
    WHERE created_at < NOW() - INTERVAL '1 hour';
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql;
END $$;

-- Create trigger conditionally
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'temp_email_sender'
  ) AND NOT EXISTS (
    SELECT FROM pg_trigger
    WHERE tgname = 'cleanup_temp_email_sender_trigger'
    AND tgrelid = 'temp_email_sender'::regclass
  ) THEN
    -- Create trigger to automatically clean up older entries
    CREATE TRIGGER cleanup_temp_email_sender_trigger
    AFTER INSERT ON temp_email_sender
    EXECUTE FUNCTION cleanup_temp_email_sender();
  END IF;
END $$; 