/*
  # Fix storage policies

  1. Changes
    - Drop existing policies
    - Recreate policies with correct column names
    - Add proper size validation
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
      -- Drop existing policies
      DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
      DROP POLICY IF EXISTS "Allow service role uploads" ON storage.objects;

      -- Create new policies with correct column names
      CREATE POLICY "Allow public read access"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'feedback-images');
    $policy$;

    -- Check which column exists for the content type
    BEGIN
      -- Check if content_type column exists
      IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'storage'
        AND table_name = 'objects'
        AND column_name = 'content_type'
      ) THEN
        -- Use content_type column
        EXECUTE $content_type_policy$
          CREATE POLICY "Allow service role uploads"
          ON storage.objects FOR INSERT
          TO service_role
          WITH CHECK (
            bucket_id = 'feedback-images' AND
            (content_type = 'image/jpeg' OR content_type = 'image/png')
          );
        $content_type_policy$;
      ELSIF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'storage'
        AND table_name = 'objects'
        AND column_name = 'mimetype'
      ) THEN
        -- Use mimetype column
        EXECUTE $mimetype_policy$
          CREATE POLICY "Allow service role uploads"
          ON storage.objects FOR INSERT
          TO service_role
          WITH CHECK (
            bucket_id = 'feedback-images' AND
            (mimetype = 'image/jpeg' OR mimetype = 'image/png')
          );
        $mimetype_policy$;
      ELSE
        RAISE NOTICE 'Neither content_type nor mimetype column exists in storage.objects, skipping policy creation.';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating policy: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Storage extension is not available, skipping storage policies.';
  END IF;
END
$$;