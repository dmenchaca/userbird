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
      feedback_id uuid NOT NULL,
      sender_email text NOT NULL,
      sender_name text,
      created_at timestamptz DEFAULT now(),
      processed boolean DEFAULT false
    );

    -- Add foreign key constraint conditionally
    IF NOT EXISTS (
      SELECT FROM pg_constraint
      WHERE conname = 'temp_email_sender_feedback_id_fkey'
      AND conrelid = 'temp_email_sender'::regclass
    ) THEN
      ALTER TABLE temp_email_sender 
      ADD CONSTRAINT temp_email_sender_feedback_id_fkey 
      FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE;
    END IF;

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

-- Create cleanup function conditionally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_proc
    WHERE proname = 'cleanup_old_temp_email_sender'
  ) THEN
    CREATE OR REPLACE FUNCTION cleanup_old_temp_email_sender()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Delete entries older than one hour
      DELETE FROM temp_email_sender
      WHERE created_at < NOW() - INTERVAL '1 hour';
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger conditionally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_trigger
    WHERE tgname = 'trigger_cleanup_temp_email_sender'
    AND tgrelid = 'temp_email_sender'::regclass
  ) THEN
    CREATE TRIGGER trigger_cleanup_temp_email_sender
    AFTER INSERT ON temp_email_sender
    EXECUTE FUNCTION cleanup_old_temp_email_sender();
  END IF;
END $$; 