/*
  # Add UPDATE policy for forms

  1. Changes
    - Add policy to allow authenticated users to update their own forms
    - Ensures users can only update forms they own
*/

-- Create policy for updating forms
CREATE POLICY "Allow users to update own forms"
ON forms FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());