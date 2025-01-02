/*
  # Update feedback foreign key constraint

  1. Changes
    - Drop and recreate feedback foreign key with CASCADE
*/

-- Drop existing foreign key constraint
ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_form_id_fkey;

-- Re-add with CASCADE
ALTER TABLE feedback
  ADD CONSTRAINT feedback_form_id_fkey
  FOREIGN KEY (form_id)
  REFERENCES forms(id)
  ON DELETE CASCADE;