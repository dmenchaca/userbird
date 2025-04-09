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

-- Check if storage extension is available and create it if possible
DO $$
BEGIN
  -- Check if storage extension is available in the system catalogs
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'storage'
  ) THEN
    -- Enable storage extension
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS "storage" SCHEMA "extensions"';

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
    EXECUTE $policy$
      DROP POLICY IF EXISTS "Public Access" ON storage.objects;
      CREATE POLICY "Public Access"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'feedback-images');
    $policy$;

    -- Only allow image uploads through our service
    EXECUTE $policy$
      DROP POLICY IF EXISTS "Upload through service only" ON storage.objects;
      CREATE POLICY "Upload through service only"
      ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (
        bucket_id = 'feedback-images' AND
        (mimetype = 'image/jpeg' OR mimetype = 'image/png')
      );
    $policy$;
  ELSE
    RAISE NOTICE 'Storage extension is not available, skipping storage configuration.';
  END IF;
END
$$;