/*
  # DNS Verification Records Access Policy
  
  This script:
  - Restricts dns_verification_records access to form owners and admin collaborators only
  - Admin collaborators have full access to manage DNS verification records
  - Agents cannot access or modify DNS verification records
*/

-- First, ensure RLS is enabled
ALTER TABLE dns_verification_records ENABLE ROW LEVEL SECURITY;

-- Revoke any existing public access
REVOKE ALL ON dns_verification_records FROM public;

-- Create policy for form owners to have full access
CREATE POLICY "Form owners can manage DNS verification records"
ON dns_verification_records
FOR ALL
TO authenticated
USING (
  custom_email_setting_id IN (
    SELECT id FROM custom_email_settings
    WHERE form_id IN (
      SELECT id FROM forms WHERE owner_id = auth.uid()
    )
  )
);

-- Create policy for admin collaborators to have full access
CREATE POLICY "Admin collaborators can manage DNS verification records"
ON dns_verification_records
FOR ALL
TO authenticated
USING (
  custom_email_setting_id IN (
    SELECT id FROM custom_email_settings
    WHERE form_id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
      AND role = 'admin'
    )
  )
);

-- No policies for agents, which means they have no access at all

-- Grant permissions to authenticated users (but policies will restrict based on roles)
GRANT ALL ON dns_verification_records TO authenticated; 