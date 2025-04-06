/*
  # Add Default Per-Form Email Addresses
  
  This migration:
  1. Adds a default_email column to the forms table
  2. Sets up the column to automatically generate a unique email address for each form
  3. Populates the column for existing forms
*/

-- Add default_email column to forms table
ALTER TABLE forms 
ADD COLUMN default_email text GENERATED ALWAYS AS (
  'form-' || id || '@userbird-mail.com'
) STORED;

-- Create function to handle email sending preferences
CREATE OR REPLACE FUNCTION get_form_sender_email(form_id text)
RETURNS text AS $$
DECLARE
  custom_email text;
  default_email text;
BEGIN
  -- First check for verified custom email
  SELECT ces.custom_email INTO custom_email
  FROM custom_email_settings ces
  WHERE ces.form_id = $1 AND ces.verified = true
  LIMIT 1;
  
  IF custom_email IS NOT NULL THEN
    RETURN custom_email;
  END IF;
  
  -- If no custom email, use the form's default email
  SELECT f.default_email INTO default_email
  FROM forms f
  WHERE f.id = $1
  LIMIT 1;
  
  IF default_email IS NOT NULL THEN
    RETURN default_email;
  END IF;
  
  -- Fallback to system default
  RETURN 'notifications@userbird.co';
END;
$$ LANGUAGE plpgsql; 