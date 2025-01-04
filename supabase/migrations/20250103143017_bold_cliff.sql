/*
  # Fix feedback table RLS policies

  1. Changes
    - Drop existing policies
    - Enable RLS
    - Create new policies with proper permissions
    - Grant explicit permissions to public role
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public feedback access" ON feedback;

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public feedback submission"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Public feedback reading"
ON feedback FOR SELECT
TO public
USING (true);

-- Grant explicit permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON feedback TO anon;
GRANT ALL ON feedback TO authenticated;
GRANT ALL ON feedback TO service_role;