/*
  # Add storage bucket for feedback images

  1. New Storage Bucket
    - Name: feedback-images
    - Public access enabled
    - File size limit: 5MB
    - Allowed MIME types: image/jpeg, image/png
    
  2. Security
    - Enable public access for read operations
    - Restrict uploads to authenticated service role only
*/

-- Enable storage if not already enabled
CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions";

-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'feedback-images',
  'feedback-images',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Set bucket size limit to 5MB
UPDATE storage.buckets
SET max_file_size = 5242880
WHERE id = 'feedback-images';

-- Allow public access to files
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-images');

-- Only allow image uploads through our service
CREATE POLICY "Upload through service only"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'feedback-images' AND
  (mimetype = 'image/jpeg' OR mimetype = 'image/png')
);