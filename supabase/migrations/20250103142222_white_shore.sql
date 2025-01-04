/*
  # Fix storage RLS policies

  1. Changes
    - Drop existing storage policies
    - Create simplified policies for public access
    - Grant explicit permissions to all roles
*/

-- Drop existing storage policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Service role unrestricted access" ON storage.objects;
DROP POLICY IF EXISTS "Service role insert access" ON storage.objects;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "Allow public storage access"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'feedback-images')
WITH CHECK (bucket_id = 'feedback-images');

-- Grant explicit permissions
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.objects TO service_role;

-- Ensure storage schema is accessible
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;