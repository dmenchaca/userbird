/*
  # Custom Email Settings Access Policy
  
  This script:
  - Restricts custom_email_settings access to form owners and admin collaborators only
  - Agents cannot access or modify email settings at all
*/

-- First, ensure RLS is enabled
ALTER TABLE custom_email_settings ENABLE ROW LEVEL SECURITY;

-- Revoke any existing public access
REVOKE ALL ON custom_email_settings FROM public;

-- Create policy for form owners to have full access
CREATE POLICY "Form owners can manage email settings"
ON custom_email_settings
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Create policy for admin collaborators to have full access
CREATE POLICY "Admin collaborators can manage email settings"
ON custom_email_settings
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

-- No policies for agents, which means they have no access at all

-- Grant permissions to authenticated users (but policies will restrict based on roles)
GRANT ALL ON custom_email_settings TO authenticated; 