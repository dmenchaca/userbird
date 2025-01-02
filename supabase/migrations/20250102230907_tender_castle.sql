/*
  # Add cascade delete for forms and feedback

  1. Changes
    - Add ON DELETE CASCADE to feedback foreign key
    - Add policy to allow public deletion of forms

  2. Security
    - Enable public deletion of forms
    - Automatically remove associated feedback when a form is deleted
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

-- Allow public form deletion
CREATE POLICY "Allow public form deletion"
  ON forms
  FOR DELETE
  TO public
  USING (true);