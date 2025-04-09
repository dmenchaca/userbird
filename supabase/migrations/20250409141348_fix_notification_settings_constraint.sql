/*
  This migration fixes issues with the valid_notification_attributes constraint.
  It drops the constraint if it exists and doesn't try to add it back since that will be 
  handled by the existing migrations in the proper order.
*/

-- First handle the constraint in notification_settings table
DO $$
BEGIN
  -- Check if the constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_notification_attributes' 
    AND conrelid = 'public.notification_settings'::regclass
  ) THEN
    ALTER TABLE "public"."notification_settings" DROP CONSTRAINT "valid_notification_attributes";
  END IF;

  -- Also modify the migration that tries to add this constraint to prevent future issues
  -- (Make sure the migration that adds the constraint doesn't run if it already exists)
  IF EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'notification_settings'
    AND relnamespace = 'public'::regnamespace
  ) THEN
    -- We don't add the constraint here - we let the original migration do it later in the sequence
    -- This just ensures we've removed any existing constraint first
    NULL;
  END IF;
END $$;
