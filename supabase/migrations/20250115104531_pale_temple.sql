/*
  # Add notification attributes settings

  1. Changes
    - Add notification_attributes column to notification_settings table
    - Add check constraint to validate attributes
    - Add default value of ['message']
*/

-- Add notification_attributes column
ALTER TABLE notification_settings
ADD COLUMN notification_attributes text[] DEFAULT ARRAY['message'];

-- Add check constraint to validate attributes
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