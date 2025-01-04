/*
  # Fix storage permissions

  1. Changes
    - Drop existing policies
    - Enable RLS
    - Create new policies with proper permissions
    - Grant full access to service role
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

-- Grant unrestricted access to service role for all operations
CREATE POLICY "Service role unrestricted access"
ON storage.objects
TO service_role
USING (true)
WITH CHECK (true);

-- Grant explicit INSERT permission to service role
CREATE POLICY "Service role insert access"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (true);

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;