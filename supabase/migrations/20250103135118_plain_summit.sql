/*
  # Simplify storage policies

  1. Changes
    - Drop existing policies
    - Create new simplified policies for read and write access
    - Remove content type validation from policy level
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role uploads" ON storage.objects;

-- Create new simplified policies
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

CREATE POLICY "Service role upload access"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'feedback-images');

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;