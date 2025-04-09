/*
  # Feedback Tags Access Policy
  
  This script:
  - Allows form owners, admin collaborators, AND agent collaborators to manage tags
  - Both admin and agent roles can perform all operations on tags
*/

-- First, ensure RLS is enabled (which appears to be the case already)
ALTER TABLE feedback_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Specific tag access" ON feedback_tags;
DROP POLICY IF EXISTS "Simple public tag access" ON feedback_tags;
DROP POLICY IF EXISTS "Owner can manage tags" ON feedback_tags;

-- Revoke any existing public access
REVOKE ALL ON feedback_tags FROM public;

-- Create policy for form owners to manage tags
CREATE POLICY "Form owners can manage tags"
ON feedback_tags
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Create unified policy for ALL collaborators (both admin and agent roles)
CREATE POLICY "Collaborators can manage tags"
ON feedback_tags
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    -- Note: No role restriction here, allowing both admin and agent roles
  )
);

-- Grant permissions to authenticated users (but policies will restrict based on roles)
GRANT ALL ON feedback_tags TO authenticated; 