/*
  # Update form access policies for collaborators

  1. Changes
    - Add policy to allow collaborators to read forms they are invited to
    - Add policy to allow admin collaborators to update forms
    - Ensures proper access control for form collaborators

  2. Security
    - Maintains existing owner-based access control
    - Extends access to invited collaborators based on their role
    - Two roles: admin (full access) and agent (limited access)
*/

-- Allow collaborators to read forms they are invited to
CREATE POLICY "Allow collaborators to read forms"
ON forms FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Allow all collaborators to update forms
CREATE POLICY "Allow collaborators to update forms"
ON forms FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Allow only admin collaborators to delete forms
CREATE POLICY "Allow admin collaborators to delete forms"
ON forms FOR DELETE
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Allow both admin and agent collaborators to view feedback
CREATE POLICY "Allow collaborators to view form feedback"
ON feedback FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Allow both admin and agent collaborators to update feedback
CREATE POLICY "Allow collaborators to update feedback"
ON feedback FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Allow only admin collaborators to delete feedback
CREATE POLICY "Allow admin collaborators to delete feedback"
ON feedback FOR DELETE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
); 