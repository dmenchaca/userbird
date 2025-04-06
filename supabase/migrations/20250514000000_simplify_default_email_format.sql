/*
  # Simplify Default Email Format
  
  This migration:
  1. Updates the default_email column in the forms table
  2. Removes the 'form-' prefix from the auto-generated email address
  3. New format: {id}@userbird-mail.com
*/

-- Drop the existing generated column
ALTER TABLE forms DROP COLUMN default_email;

-- Re-add the column with the simpler format
ALTER TABLE forms 
ADD COLUMN default_email text GENERATED ALWAYS AS (
  id || '@userbird-mail.com'
) STORED; 