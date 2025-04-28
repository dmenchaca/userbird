/*
  # Update Default Email Generation Format
  
  This migration:
  1. Updates the trigger function that generates default_email for NEW forms only
  2. Changes format from support@{product_name}.userbird-mail.com to support-{product_name}@userbird-mail.com
  3. Preserves all existing email addresses without modification
*/

-- Update trigger function to use the new format only for new forms
CREATE OR REPLACE FUNCTION set_default_email_from_product_name()
RETURNS TRIGGER AS $$
DECLARE
  base_name text;
  candidate_email text;
  counter integer := 1;
BEGIN
  -- Slugify product_name: lowercase, remove non-alphanum, replace spaces with nothing
  base_name := regexp_replace(lower(NEW.product_name), '[^a-z0-9]', '', 'g');
  
  -- Skip trigger if no product name is available
  IF base_name = '' OR base_name IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- New format: support-{product_name}@userbird-mail.com
  candidate_email := 'support-' || base_name || '@userbird-mail.com';

  -- Check for uniqueness, append a number if needed
  WHILE EXISTS (
    SELECT 1 FROM forms WHERE default_email = candidate_email AND id != NEW.id
  ) LOOP
    counter := counter + 1;
    candidate_email := 'support-' || base_name || counter::text || '@userbird-mail.com';
  END LOOP;

  NEW.default_email := candidate_email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update comment to clarify the mixed format situation
COMMENT ON COLUMN forms.default_email IS 'Default support email for form. For forms created before 2025-04-29: format is support@{product_name}.userbird-mail.com. For newer forms: format is support-{product_name}@userbird-mail.com';
COMMENT ON FUNCTION set_default_email_from_product_name() IS 'Sets the default_email based on product_name with collision handling. New format as of 2025-04-29.';

-- Add migration complete message
DO $$
BEGIN
  RAISE NOTICE 'Default email format updated for new forms only to support-{product_name}@userbird-mail.com. Existing emails preserved.';
END $$; 