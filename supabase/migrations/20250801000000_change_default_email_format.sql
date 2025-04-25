/*
  # Change Default Email Generation Logic for New Forms
  
  This migration:
  1. Changes default_email from a generated column to a regular column
  2. Implements a trigger to set default_email based on product_name for NEW forms only
  3. Ensures uniqueness by appending a number if needed
  
  New format: support@{product_name}.userbird-mail.com
  For collisions: support@{product_name}2.userbird-mail.com, support@{product_name}3.userbird-mail.com, etc.
  
  Note: This change only affects newly created forms. Existing forms will keep their current default_email.
*/

-- Preserve existing default_email values 
CREATE TEMPORARY TABLE temp_default_emails AS
SELECT id, default_email FROM forms;

-- Drop the generated column
ALTER TABLE forms DROP COLUMN IF EXISTS default_email;

-- Add a regular column
ALTER TABLE forms ADD COLUMN default_email text;

-- Add a unique index
CREATE UNIQUE INDEX IF NOT EXISTS forms_default_email_unique ON forms(default_email);

-- Create trigger function to set default_email based on product_name
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
  
  candidate_email := 'support@' || base_name || '.userbird-mail.com';

  -- Check for uniqueness, append a number if needed
  WHILE EXISTS (
    SELECT 1 FROM forms WHERE default_email = candidate_email AND id != NEW.id
  ) LOOP
    counter := counter + 1;
    candidate_email := 'support@' || base_name || counter::text || '.userbird-mail.com';
  END LOOP;

  NEW.default_email := candidate_email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT only
DROP TRIGGER IF EXISTS set_default_email_on_insert ON forms;
CREATE TRIGGER set_default_email_on_insert
BEFORE INSERT ON forms
FOR EACH ROW
WHEN (NEW.product_name IS NOT NULL AND NEW.product_name != '')
EXECUTE FUNCTION set_default_email_from_product_name();

-- Restore existing default_email values
UPDATE forms f
SET default_email = t.default_email
FROM temp_default_emails t
WHERE f.id = t.id;

-- Drop the temporary table
DROP TABLE temp_default_emails;

-- Add helpful comments
COMMENT ON COLUMN forms.default_email IS 'Default support email for form. For new forms, uses format support@{product_name}.userbird-mail.com';
COMMENT ON FUNCTION set_default_email_from_product_name() IS 'Sets the default_email based on product_name with collision handling'; 