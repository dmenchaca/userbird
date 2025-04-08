/*
  # Fix form_collaborators RLS policies

  1. Changes
    - Drop existing restrictive policy that only allows form owners to manage collaborators
    - Create new policy that allows both form owners AND admin collaborators to manage collaborators
    - Ensure consistent permissions across the system
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Form owners can manage collaborators" ON form_collaborators;

-- Create a more flexible policy that allows both owners and admins to manage collaborators
CREATE POLICY "Users can manage collaborators if owner or admin"
ON form_collaborators
FOR ALL
TO authenticated
USING (
  -- Allow if user is the form owner
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_collaborators.form_id
    AND forms.owner_id = auth.uid()
  )
  OR 
  -- Allow if user is an admin collaborator for this form
  EXISTS (
    SELECT 1 
    FROM form_collaborators existing_collab
    WHERE existing_collab.form_id = form_collaborators.form_id
    AND existing_collab.user_id = auth.uid()
    AND existing_collab.role = 'admin'
  )
)
WITH CHECK (
  -- Same condition for write operations
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_collaborators.form_id
    AND forms.owner_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 
    FROM form_collaborators existing_collab
    WHERE existing_collab.form_id = form_collaborators.form_id
    AND existing_collab.user_id = auth.uid()
    AND existing_collab.role = 'admin'
  )
);

-- Create policy for users to insert themselves as collaborators via email acceptance (if needed)
-- Only needed if you plan to implement email acceptance of invitations
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