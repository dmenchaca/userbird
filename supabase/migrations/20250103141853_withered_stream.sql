/*
  # Fix feedback table policies

  1. Changes
    - Drop existing policies
    - Enable RLS
    - Create new policies with proper permissions
    - Grant public insert access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public feedback submission" ON feedback;
DROP POLICY IF EXISTS "Allow public feedback reading" ON feedback;

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public feedback submission"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow public feedback reading"
ON feedback FOR SELECT
TO public
USING (true);

-- Grant explicit permissions
GRANT INSERT ON feedback TO public;
GRANT SELECT ON feedback TO public;