/*
  # Webhook Settings Access Policy
  
  This script:
  - Restricts webhook_settings access to form owners and admin collaborators
  - Prevents agents from accessing or modifying webhook settings
*/

-- First, ensure RLS is enabled (which appears to be the case already)
ALTER TABLE webhook_settings ENABLE ROW LEVEL SECURITY;

-- Revoke any existing public access
REVOKE ALL ON webhook_settings FROM public;

-- Create policy for form owners to manage their webhook settings
DROP POLICY IF EXISTS "Form owners can manage webhook_settings" ON webhook_settings;

CREATE POLICY "Form owners can manage webhook_settings"
ON webhook_settings
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Create policy specifically for admin collaborators
DROP POLICY IF EXISTS "Admin collaborators can manage webhook_settings" ON webhook_settings;

CREATE POLICY "Admin collaborators can manage webhook_settings"
ON webhook_settings
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND role = 'admin'
    AND invitation_accepted = true
  )
);

-- Regular agent collaborators will have no access since no policy applies to them

-- Grant permissions to authenticated users (but policies will restrict based on role)
GRANT ALL ON webhook_settings TO authenticated; 