/*
  # Add notification attributes settings

  1. Changes
    - Add notification_attributes column to notification_settings table
    - Add check constraint to validate attributes
    - Add default value of ['message']
*/

-- Add notification_attributes column
DO $$
BEGIN
  -- Check if the column exists before adding it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_settings' 
    AND column_name = 'notification_attributes'
  ) THEN
    ALTER TABLE notification_settings
    ADD COLUMN notification_attributes text[] DEFAULT ARRAY['message'];
  END IF;

  -- Add check constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'valid_notification_attributes' 
    AND conrelid = 'public.notification_settings'::regclass
  ) THEN
    ALTER TABLE notification_settings
    ADD CONSTRAINT valid_notification_attributes CHECK (
      notification_attributes <@ ARRAY[
        'message',
        'user_id',
        'user_email',
        'user_name',
        'operating_system',
        'screen_category',
        'image_url',
        'image_name',
        'created_at'
      ]::text[]
    );
  END IF;
END $$;