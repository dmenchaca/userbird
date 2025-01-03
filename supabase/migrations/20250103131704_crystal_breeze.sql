/*
  # Add any missing columns

  This migration ensures all required columns exist and have proper constraints.
  It uses IF NOT EXISTS to avoid errors if columns were already added by previous migrations.
*/

-- Add image-related columns if they don't exist
DO $$ 
BEGIN
  -- Add image_url if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE feedback ADD COLUMN image_url text;
  END IF;

  -- Add image_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback' AND column_name = 'image_name'
  ) THEN
    ALTER TABLE feedback ADD COLUMN image_name text;
  END IF;

  -- Add image_size if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'feedback' AND column_name = 'image_size'
  ) THEN
    ALTER TABLE feedback ADD COLUMN image_size integer;
  END IF;
END $$;

-- Add constraints if they don't exist
DO $$ 
BEGIN
  -- Add image size constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'valid_image_size'
  ) THEN
    ALTER TABLE feedback
    ADD CONSTRAINT valid_image_size 
      CHECK (image_size IS NULL OR image_size <= 5242880);
  END IF;

  -- Add image extension constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'valid_image_extension'
  ) THEN
    ALTER TABLE feedback
    ADD CONSTRAINT valid_image_extension 
      CHECK (
        image_name IS NULL OR 
        image_name ~* '.*\.(jpg|jpeg|png)$'
      );
  END IF;
END $$;