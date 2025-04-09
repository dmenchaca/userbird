/*
  # Fix storage policies

  1. Changes
    - Fix column name in storage policies from mimetype to content_type
    - Update policy conditions to use correct column names
  
  2. Security
    - Maintain same security rules but with correct column references
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

      -- Recreate policies with correct column names
      CREATE POLICY "Allow public read access"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'feedback-images');

      -- Check if the content_type column exists
      DO $inner$
      BEGIN
        IF EXISTS (
          SELECT FROM pg_attribute 
          WHERE attrelid = 'storage.objects'::regclass
          AND attname = 'content_type' 
          AND NOT attisdropped
        ) THEN
          -- Use content_type column
          EXECUTE $inner_policy$
            CREATE POLICY "Allow service role uploads"
            ON storage.objects FOR INSERT
            TO service_role
            WITH CHECK (
              bucket_id = 'feedback-images' AND
              (content_type = 'image/jpeg' OR content_type = 'image/png') AND
              octet_length(content) <= 5242880
            );
          $inner_policy$;
        ELSIF EXISTS (
          SELECT FROM pg_attribute 
          WHERE attrelid = 'storage.objects'::regclass
          AND attname = 'mimetype' 
          AND NOT attisdropped
        ) THEN
          -- Use mimetype column
          EXECUTE $inner_policy$
            CREATE POLICY "Allow service role uploads"
            ON storage.objects FOR INSERT
            TO service_role
            WITH CHECK (
              bucket_id = 'feedback-images' AND
              (mimetype = 'image/jpeg' OR mimetype = 'image/png') AND
              octet_length(content) <= 5242880
            );
          $inner_policy$;
        ELSE
          RAISE NOTICE 'Neither content_type nor mimetype column exists in storage.objects, skipping policy creation.';
        END IF;
      END $inner$;
    $policy$;
  ELSE
    RAISE NOTICE 'Storage extension is not available, skipping storage policies.';
  END IF;
END
$$;