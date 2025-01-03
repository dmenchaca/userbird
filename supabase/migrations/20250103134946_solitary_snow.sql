/*
  # Fix storage policies with correct column names

  1. Changes
    - Drop existing policies
    - Create new policies using correct column names
    - Remove content type check from policy (handled by bucket configuration)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role uploads" ON storage.objects;

-- Create new simplified policies
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

CREATE POLICY "Allow service role uploads"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'feedback-images');