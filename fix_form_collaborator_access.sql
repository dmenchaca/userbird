/*
  # Fix Form Collaborator Access
  
  This script ensures collaborators can properly access form details
  while maintaining security for unauthenticated users.
*/

-- First, let's make sure our helper function is properly defined
DROP FUNCTION IF EXISTS user_has_form_access(TEXT, UUID);

CREATE OR REPLACE FUNCTION user_has_form_access(form_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct owner check without RLS
  IF EXISTS (
    SELECT 1 FROM forms
    WHERE id = form_id_param 
    AND owner_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;

  -- Collaborator check without RLS
  IF EXISTS (
    SELECT 1 FROM form_collaborators
    WHERE form_id = form_id_param
    AND user_id = user_id_param
    AND invitation_accepted = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Fix the authenticated user access policy to ensure it includes collaborators
DROP POLICY IF EXISTS "Authenticated users can read forms they own or collaborate on" ON forms;

CREATE POLICY "Authenticated users can read forms they own or collaborate on"
ON forms FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR 
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- Ensure collaborators can also update forms they have access to
CREATE POLICY "Collaborators can update forms"
ON forms FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'admin'
  )
);

-- Grant execute permission to the function
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated;

-- Ensure forms table has the right permissions
GRANT ALL ON forms TO authenticated; 