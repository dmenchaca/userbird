/*
  # Fix Forwarding Address Column

  This migration ensures the forwarding_address column is a regular column
  that can be set manually, not a generated column.
*/

-- First, check if there's a trigger updating this column
DO $$
DECLARE
  trigger_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'custom_email_settings'
    AND trigger_name LIKE '%forwarding_address%'
  ) INTO trigger_exists;
  
  IF trigger_exists THEN
    -- Drop any trigger that might be affecting this column
    EXECUTE 'DROP TRIGGER IF EXISTS set_forwarding_address ON custom_email_settings';
    EXECUTE 'DROP FUNCTION IF EXISTS update_forwarding_address()';
  END IF;
END $$;

-- Check if forwarding_address is a generated column
DO $$
DECLARE
  col_generation TEXT;
BEGIN
  SELECT generation_expression INTO col_generation
  FROM information_schema.columns
  WHERE table_name = 'custom_email_settings'
  AND column_name = 'forwarding_address'
  AND table_schema = 'public';
  
  -- If there's a generation expression, it's a generated column
  IF col_generation IS NOT NULL THEN
    -- If it's a generated column, we need to drop and recreate it as a regular column
    ALTER TABLE custom_email_settings DROP COLUMN forwarding_address;
    ALTER TABLE custom_email_settings ADD COLUMN forwarding_address text;
  END IF;
END $$;

-- If it exists but isn't generated, make sure it's updatable
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_email_settings'
    AND column_name = 'forwarding_address'
    AND table_schema = 'public'
  ) INTO column_exists;
  
  IF NOT column_exists THEN
    -- Add the column if it doesn't exist
    ALTER TABLE custom_email_settings ADD COLUMN forwarding_address text;
  END IF;
END $$;

-- Update all existing records to have correct forwarding address
UPDATE custom_email_settings
SET forwarding_address = form_id || '@userbird-mail.com'
WHERE forwarding_address IS NULL; 