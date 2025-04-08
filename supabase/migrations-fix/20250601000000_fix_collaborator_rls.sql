/*
  # Fix form_collaborators RLS policies

  1. Changes
    - Drop existing restrictive policy that only allows form owners to manage collaborators
    - Create new policy that allows both form owners AND admin collaborators to manage collaborators
    - Ensure consistent permissions across the system
    - Fix infinite recursion issues
*/

-- First, drop any existing policies
DROP POLICY IF EXISTS "Form owners can manage collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Users can view forms they are invited to" ON form_collaborators;
DROP POLICY IF EXISTS "Users can manage collaborators if owner or admin" ON form_collaborators;
DROP POLICY IF EXISTS "Users can accept invitations via email" ON form_collaborators;

-- Create a policy for form owners that doesn't require recursion
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
);

-- Create separate non-recursive policies for admin collaborators
CREATE POLICY "Admin collaborators can select existing collaborators"
ON form_collaborators
FOR SELECT 
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin collaborators can insert new collaborators"
ON form_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin collaborators can update existing collaborators"
ON form_collaborators
FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin collaborators can delete existing collaborators"
ON form_collaborators
FOR DELETE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create policy for all collaborators to view their own collaborator record
CREATE POLICY "Users can view forms they are invited to"
ON form_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create policy for users to accept invitations by email (if implementing this feature)
CREATE POLICY "Users can accept invitations via email"
ON form_collaborators
FOR UPDATE
TO authenticated
USING (
  invitation_email = (
    SELECT email FROM auth.users
    WHERE auth.users.id = auth.uid()
  )
  AND user_id IS NULL
)
WITH CHECK (
  user_id = auth.uid()
  AND invitation_accepted = true
); 