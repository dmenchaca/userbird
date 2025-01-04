/*
  # Fix storage policies for feedback images

  1. Changes
    - Drop existing policies
    - Create new policies for public read and service role upload
    - Enable RLS on objects table
    - Add policy for authenticated uploads
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Service role upload access" ON storage.objects;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

-- Allow authenticated uploads
CREATE POLICY "Authenticated upload access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'feedback-images');

-- Allow service role full access
CREATE POLICY "Service role access"
ON storage.objects
TO service_role
USING (bucket_id = 'feedback-images')
WITH CHECK (bucket_id = 'feedback-images');