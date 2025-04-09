/*
  # Notification Settings Access Policy
  
  This script:
  - Restricts notification_settings access to form owners and admin collaborators
  - Prevents agents from accessing or modifying notification settings
*/

-- First, ensure RLS is enabled (which appears to be the case already)
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Revoke any existing public access
REVOKE ALL ON notification_settings FROM public;

-- Create policy for form owners to manage their notification settings
DROP POLICY IF EXISTS "Form owners can manage notification_settings" ON notification_settings;

CREATE POLICY "Form owners can manage notification_settings"
ON notification_settings
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Create policy specifically for admin collaborators
DROP POLICY IF EXISTS "Admin collaborators can manage notification_settings" ON notification_settings;

CREATE POLICY "Admin collaborators can manage notification_settings"
ON notification_settings
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
GRANT ALL ON notification_settings TO authenticated; 