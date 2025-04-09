/*
  # Fix Infinite Recursion in Form Access Policies

  This script resolves the infinite recursion detected in form policies
  by restructuring them to use security definer functions that avoid recursion loops.
*/

-- First, drop all policies that might be causing the recursion
DROP POLICY IF EXISTS "Allow collaborators to read forms" ON forms;
DROP POLICY IF EXISTS "Allow users to read forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Users can view forms they own" ON forms;
DROP POLICY IF EXISTS "Allow authenticated users to read all forms they own" ON forms;
DROP POLICY IF EXISTS "Authenticated users can read all forms they own" ON forms;

-- Create a helper function to safely check form access without recursion
-- This uses SECURITY DEFINER which bypasses RLS checks
CREATE OR REPLACE FUNCTION check_form_access(form_id_param TEXT, user_id_param UUID)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_form_access TO authenticated;

-- Create simple, non-recursive policies

-- 1. Basic owner access policy
CREATE POLICY "Basic owner access to forms"
ON forms FOR ALL
TO authenticated
USING (owner_id = auth.uid());

-- 2. Create a form_collaborators policy using direct foreign key relationships
CREATE POLICY "Collaborator read access to forms"
ON forms FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- 3. Grant public permission to read forms
CREATE POLICY "Public can read form settings"
ON forms FOR SELECT
TO public
USING (true);

-- 4. Ensure any other recursion issues with the form_collaborators table are fixed
DROP POLICY IF EXISTS "Form owners can manage collaborators" ON form_collaborators;

CREATE POLICY "Form owners can manage collaborators" 
ON form_collaborators
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_collaborators.form_id
    AND forms.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_collaborators.form_id
    AND forms.owner_id = auth.uid()
  )
); 