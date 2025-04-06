/*
  # Add Temporary Email Sender Table
  
  This table is used as a communication bridge for custom email functionality
  - Stores sender information temporarily before it's used by the email service
  - Automatically clears old entries to maintain performance
*/

-- Create temp_email_sender table
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

-- Create policy to allow internal services to use this table
CREATE POLICY "Service functions can manage temp_email_sender"
ON temp_email_sender
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add function to clean up old entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_temp_email_sender()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM temp_email_sender
  WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clean up older entries
CREATE TRIGGER cleanup_temp_email_sender_trigger
AFTER INSERT ON temp_email_sender
EXECUTE FUNCTION cleanup_temp_email_sender(); 