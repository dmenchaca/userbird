/*
  # Feedback Access Policy
  
  This script:
  - Allows public to submit feedback
  - Allows form owners and admin collaborators to perform ALL operations
  - Allows agent collaborators to view, create, and update feedback, but NOT delete them
*/

-- First, ensure RLS is enabled
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Specific feedback access" ON feedback;

-- Keep the public submission policy
CREATE POLICY "Public can submit feedback"
ON feedback
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy for form owners to have full access
CREATE POLICY "Form owners can manage feedback"
ON feedback
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Create policy for admin collaborators to have full access
CREATE POLICY "Admin collaborators can manage feedback"
ON feedback
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'admin'
  )
);

-- Create separate policies for agent collaborators with limited permissions

-- 1. Agents can SELECT feedback
CREATE POLICY "Agent collaborators can view feedback"
ON feedback
FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'agent'
  )
);

-- 2. Agents can UPDATE feedback (change status, etc.)
CREATE POLICY "Agent collaborators can update feedback"
ON feedback
FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'agent'
  )
)
WITH CHECK (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'agent'
  )
);

-- No DELETE policy for agents, which means they cannot delete feedback

-- Revoke any excess public access, but keep the ability to insert
REVOKE ALL ON feedback FROM public;
GRANT INSERT ON feedback TO public;

-- Grant permissions to authenticated users (but policies will restrict based on roles)
GRANT ALL ON feedback TO authenticated; 