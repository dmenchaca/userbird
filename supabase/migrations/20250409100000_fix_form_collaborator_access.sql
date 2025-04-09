/*
  # Fix Form Collaborator Access

  1. Drop conflicting policies
  2. Create simplified policies that avoid recursion
  3. Add direct access to forms for collaborators
*/

-- Drop any conflicting policies
DROP POLICY IF EXISTS "Allow users to read forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Allow collaborators to read forms" ON forms;
DROP POLICY IF EXISTS "Collaborator read access to forms" ON forms;
DROP POLICY IF EXISTS "Users can view forms they are invited to" ON form_collaborators;

-- Create a policy that allows users to view forms they own
CREATE POLICY "Users can view forms they own" 
ON forms FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Create a policy that allows users to view forms they collaborate on
-- This is a direct policy without recursion
CREATE POLICY "Users can view forms they collaborate on" 
ON forms FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM form_collaborators
    WHERE form_collaborators.form_id = id
    AND form_collaborators.user_id = auth.uid()
    AND form_collaborators.invitation_accepted = true
  )
);

-- Create a policy that allows users to view their own collaborator records
CREATE POLICY "Users can view their collaborator records" 
ON form_collaborators FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create a separate policy for viewing collaborator records by form owners
CREATE POLICY "Form owners can view all collaborator records" 
ON form_collaborators FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create a helper function that safely checks if a user has access to a form
CREATE OR REPLACE FUNCTION user_has_form_access(form_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM forms WHERE id = form_id_param AND owner_id = user_id_param
  ) OR EXISTS (
    SELECT 1 FROM form_collaborators 
    WHERE form_id = form_id_param 
    AND user_id = user_id_param
    AND invitation_accepted = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated; 