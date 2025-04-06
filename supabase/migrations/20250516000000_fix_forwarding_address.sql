/*
  # Fix Forwarding Address for Custom Email Settings

  This migration updates any existing custom_email_settings records
  to ensure they have a correct forwarding_address using the form_id.
*/

-- Update existing records that have missing or incorrect forwarding_address
UPDATE custom_email_settings
SET forwarding_address = form_id || '@userbird-mail.com'
WHERE forwarding_address IS NULL 
   OR forwarding_address != form_id || '@userbird-mail.com'; 