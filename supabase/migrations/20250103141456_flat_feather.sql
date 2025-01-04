/*
  # Fix storage policies for service role

  1. Changes
    - Drop existing policies
    - Create new policy for service role with full access
    - Ensure RLS is enabled
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload access" ON storage.objects;
DROP POLICY IF EXISTS "Service role access" ON storage.objects;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

-- Grant full access to service role
CREATE POLICY "Service role full access"
ON storage.objects
TO service_role
USING (true)
WITH CHECK (true);