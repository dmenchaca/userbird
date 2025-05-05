/*
  # Update Custom Email Settings Access for Agents
  
  This migration:
  - Adds a new policy to allow agents to view (but not modify) custom email settings
  - Ensures agents can see the custom email when viewing tickets
*/

-- Create policy for agents to have read-only access to custom_email_settings
CREATE POLICY "Agents can view email settings"
ON custom_email_settings
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