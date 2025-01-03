/*
  # Fix storage policies

  1. Changes
    - Fix column name in storage policies from mimetype to content_type
    - Update policy conditions to use correct column names
  
  2. Security
    - Maintain same security rules but with correct column references
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow service role uploads" ON storage.objects;

-- Recreate policies with correct column names
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

CREATE POLICY "Allow service role uploads"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'feedback-images' AND
  (content_type = 'image/jpeg' OR content_type = 'image/png') AND
  octet_length(content) <= 5242880
);