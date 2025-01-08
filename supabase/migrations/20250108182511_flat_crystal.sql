/*
  # Rollback notification settings

  This migration removes the notification settings table and related functionality.
*/

-- Drop notification settings table and all its dependencies
DROP TABLE IF EXISTS notification_settings;

-- Remove notification-related functions from feedback handler
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_form_id_fkey;
ALTER TABLE feedback 
  ADD CONSTRAINT feedback_form_id_fkey 
  FOREIGN KEY (form_id) 
  REFERENCES forms(id) 
  ON DELETE CASCADE;