/*
  # Feedback Replies Access Policy
  
  This script:
  - Allows form owners and admin collaborators to perform ALL operations
  - Allows agent collaborators to view, create, and update replies, but NOT delete them
*/

-- First, ensure RLS is enabled
ALTER TABLE feedback_replies ENABLE ROW LEVEL SECURITY;

-- Revoke any existing public access
REVOKE ALL ON feedback_replies FROM public;

-- Create policy for form owners to have full access
CREATE POLICY "Form owners can manage replies"
ON feedback_replies
FOR ALL
TO authenticated
USING (
  feedback_id IN (
    SELECT id FROM feedback 
    WHERE form_id IN (
      SELECT id FROM forms WHERE owner_id = auth.uid()
    )
  )
);

-- Create policy for admin collaborators to have full access
CREATE POLICY "Admin collaborators can manage replies"
ON feedback_replies
FOR ALL
TO authenticated
USING (
  feedback_id IN (
    SELECT id FROM feedback 
    WHERE form_id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
      AND role = 'admin'
    )
  )
);

-- Create separate policies for agent collaborators with limited permissions

-- 1. Agents can SELECT replies
CREATE POLICY "Agent collaborators can view replies"
ON feedback_replies
FOR SELECT
TO authenticated
USING (
  feedback_id IN (
    SELECT id FROM feedback 
    WHERE form_id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
      AND role = 'agent'
    )
  )
);

-- 2. Agents can INSERT replies
CREATE POLICY "Agent collaborators can create replies"
ON feedback_replies
FOR INSERT
TO authenticated
WITH CHECK (
  feedback_id IN (
    SELECT id FROM feedback 
    WHERE form_id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
      AND role = 'agent'
    )
  )
);

-- 3. Agents can UPDATE replies
CREATE POLICY "Agent collaborators can update replies"
ON feedback_replies
FOR UPDATE
TO authenticated
USING (
  feedback_id IN (
    SELECT id FROM feedback 
    WHERE form_id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
      AND role = 'agent'
    )
  )
)
WITH CHECK (
  feedback_id IN (
    SELECT id FROM feedback 
    WHERE form_id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
      AND role = 'agent'
    )
  )
);

-- No DELETE policy for agents, which means they cannot delete replies

-- Grant permissions to authenticated users (but policies will restrict based on roles)
GRANT ALL ON feedback_replies TO authenticated; 