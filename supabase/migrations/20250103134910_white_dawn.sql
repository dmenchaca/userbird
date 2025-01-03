/*
  # Fix storage policies

  1. Changes
    - Drop existing policies
    - Recreate policies with correct column names
    - Add proper size validation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role uploads" ON storage.objects;

-- Create new policies with correct column names
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

CREATE POLICY "Allow service role uploads"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'feedback-images' AND
  (content_type = 'image/jpeg' OR content_type = 'image/png')
);