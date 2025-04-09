/*
  # Form Collaborators Access Policy
  
  This script:
  - Sets up basic security for form_collaborators table 
  - Allows authenticated users to view (SELECT) all form collaborations for UI dropdown purposes
  - Restricts modifications (INSERT, UPDATE, DELETE) to form owners and admin collaborators
*/

-- First, ensure RLS is enabled
ALTER TABLE form_collaborators ENABLE ROW LEVEL SECURITY;

-- Revoke any existing public access
REVOKE ALL ON form_collaborators FROM public;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Form owners can manage collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Users can view their collaborations" ON form_collaborators;
DROP POLICY IF EXISTS "Form collaborator direct access" ON form_collaborators;
DROP POLICY IF EXISTS "Admin collaborators can manage collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Authenticated users can view collaborations" ON form_collaborators;
DROP POLICY IF EXISTS "Form owners can modify collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Admin collaborators can modify collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Form owners can insert collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Form owners can update collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Form owners can delete collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Admin collaborators can insert collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Admin collaborators can update collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Admin collaborators can delete collaborators" ON form_collaborators;

-- Allow all authenticated users to view collaborations (needed for form name dropdowns)
CREATE POLICY "Authenticated users can view collaborations" 
ON form_collaborators
FOR SELECT
TO authenticated
USING (true);

-- Create policy for form owners to insert collaborators
CREATE POLICY "Form owners can insert collaborators" 
ON form_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  form_id IN (
    SELECT id FROM forms
    WHERE forms.owner_id = auth.uid()
  )
);

-- Create policy for form owners to update collaborators
CREATE POLICY "Form owners can update collaborators" 
ON form_collaborators
FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms
    WHERE forms.owner_id = auth.uid()
  )
);

-- Create policy for form owners to delete collaborators
CREATE POLICY "Form owners can delete collaborators" 
ON form_collaborators
FOR DELETE
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms
    WHERE forms.owner_id = auth.uid()
  )
);

-- Create policy for admin collaborators to insert collaborators
CREATE POLICY "Admin collaborators can insert collaborators"
ON form_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'admin'
  )
);

-- Create policy for admin collaborators to update collaborators
CREATE POLICY "Admin collaborators can update collaborators"
ON form_collaborators
FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'admin'
  )
);

-- Create policy for admin collaborators to delete collaborators
CREATE POLICY "Admin collaborators can delete collaborators"
ON form_collaborators
FOR DELETE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'admin'
  )
);

-- Grant permissions to authenticated users (but policies will restrict based on roles)
GRANT ALL ON form_collaborators TO authenticated; 