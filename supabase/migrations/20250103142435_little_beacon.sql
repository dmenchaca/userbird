/*
  # Fix feedback table RLS policies

  1. Changes
    - Drop existing feedback policies
    - Create simplified policies for public access
    - Grant explicit permissions to all roles
*/

-- Drop existing feedback policies
DROP POLICY IF EXISTS "Public feedback submission" ON feedback;
DROP POLICY IF EXISTS "Public feedback reading" ON feedback;

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "Allow public feedback access"
ON feedback FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Grant explicit permissions
GRANT ALL ON feedback TO anon;
GRANT ALL ON feedback TO authenticated;
GRANT ALL ON feedback TO service_role;

-- Ensure schema is accessible
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;