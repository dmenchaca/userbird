-- Add image-related columns conditionally
DO $$
BEGIN
  -- Check for image_url column
  IF NOT EXISTS (
    SELECT FROM pg_attribute 
    WHERE attrelid = 'feedback'::regclass
    AND attname = 'image_url'
    AND NOT attisdropped
  ) THEN
    ALTER TABLE feedback ADD COLUMN image_url text;
  END IF;
  
  -- Check for image_name column
  IF NOT EXISTS (
    SELECT FROM pg_attribute 
    WHERE attrelid = 'feedback'::regclass
    AND attname = 'image_name'
    AND NOT attisdropped
  ) THEN
    ALTER TABLE feedback ADD COLUMN image_name text;
  END IF;
  
  -- Check for image_size column
  IF NOT EXISTS (
    SELECT FROM pg_attribute 
    WHERE attrelid = 'feedback'::regclass
    AND attname = 'image_size'
    AND NOT attisdropped
  ) THEN
    ALTER TABLE feedback ADD COLUMN image_size integer;
  END IF;
END
$$;

-- Add constraints conditionally
DO $$
BEGIN
  -- Check for valid_image_size constraint
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conname = 'valid_image_size'
    AND conrelid = 'feedback'::regclass
  ) THEN
    ALTER TABLE feedback
    ADD CONSTRAINT valid_image_size 
      CHECK (image_size IS NULL OR image_size <= 5242880); -- 5MB in bytes
  END IF;
  
  -- Check for valid_image_extension constraint
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conname = 'valid_image_extension'
    AND conrelid = 'feedback'::regclass
  ) THEN
    ALTER TABLE feedback
    ADD CONSTRAINT valid_image_extension 
      CHECK (
        image_name IS NULL OR 
        image_name ~* '.*\.(jpg|jpeg|png)$'
      );
  END IF;
END
$$;