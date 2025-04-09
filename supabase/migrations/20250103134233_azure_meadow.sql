/*
  # Add storage policies

  1. Changes
    - Add public SELECT policy for feedback-images bucket
    - Add service role INSERT policy for feedback-images bucket
    - Update existing policies to be more specific
  
  2. Security
    - Allow public read access to all images
    - Restrict uploads to service role only
    - Maintain file type and size restrictions
*/

-- Check if storage extension is available
DO $$
BEGIN
  -- Check if storage extension is installed
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'storage'
  ) THEN
    -- Execute storage-related operations
    EXECUTE $policy$
      -- Allow public SELECT access to all files in the bucket
      DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
      CREATE POLICY "Allow public read access"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'feedback-images');

      -- Allow service role INSERT access
      DROP POLICY IF EXISTS "Allow service role uploads" ON storage.objects;
      CREATE POLICY "Allow service role uploads"
      ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (
        bucket_id = 'feedback-images' AND
        (mimetype = 'image/jpeg' OR mimetype = 'image/png') AND
        octet_length(content) <= 5242880
      );

      -- Drop any conflicting policies
      DROP POLICY IF EXISTS "Public Access" ON storage.objects;
      DROP POLICY IF EXISTS "Upload through service only" ON storage.objects;
    $policy$;
  ELSE
    RAISE NOTICE 'Storage extension is not available, skipping storage policies.';
  END IF;
END
$$;