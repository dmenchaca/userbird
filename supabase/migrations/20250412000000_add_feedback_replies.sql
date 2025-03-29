/*
  # Add feedback replies functionality

  1. New Tables
    - `feedback_replies`
      - `id` (uuid, primary key) - The unique reply identifier
      - `feedback_id` (uuid, foreign key to feedback.id) - The original feedback this reply is for
      - `sender_type` (text, enum) - Who sent the reply ("admin" or "user")
      - `content` (text) - The reply message content
      - `created_at` (timestamp) - When the reply was created
      - `updated_at` (timestamp) - When the reply was last updated

  2. Security
    - Enable RLS on the feedback_replies table
    - Add policies for public access to feedback_replies table
*/

-- Create enum type for sender_type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sender_type_enum') THEN
    CREATE TYPE sender_type_enum AS ENUM ('admin', 'user');
  END IF;
END $$;

-- Create feedback_replies table
CREATE TABLE IF NOT EXISTS feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES feedback(id) ON DELETE CASCADE,
  sender_type sender_type_enum NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_feedback_replies_feedback_id ON feedback_replies(feedback_id);

-- Enable RLS
ALTER TABLE feedback_replies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public feedback reply submission"
  ON feedback_replies
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public feedback reply reading"
  ON feedback_replies
  FOR SELECT
  TO public
  USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedback_replies_updated_at
BEFORE UPDATE ON feedback_replies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 