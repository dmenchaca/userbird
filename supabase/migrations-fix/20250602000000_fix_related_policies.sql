/*
  # Fix webhook_settings and notification_settings RLS policies

  1. Changes
    - Fix infinite recursion issues in policies for webhook_settings and notification_settings
    - Create non-recursive policies that properly check permissions
*/

-- First, drop ALL existing policies for webhook_settings to avoid conflicts
DROP POLICY IF EXISTS "Form owners can manage webhook settings" ON webhook_settings;
DROP POLICY IF EXISTS "Admin collaborators can manage webhook settings" ON webhook_settings;
DROP POLICY IF EXISTS "Agent collaborators can view webhook settings" ON webhook_settings;
DROP POLICY IF EXISTS "Form owners can read webhook settings" ON webhook_settings;
DROP POLICY IF EXISTS "Form owners can update webhook settings" ON webhook_settings;
DROP POLICY IF EXISTS "Form owners can insert webhook settings" ON webhook_settings;
DROP POLICY IF EXISTS "Form owners can delete webhook settings" ON webhook_settings;

-- Create updated policies for webhook_settings
CREATE POLICY "Form owners can manage webhook settings" 
ON webhook_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = webhook_settings.form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create a safe non-recursive policy for admin collaborators
CREATE POLICY "Admin collaborators can manage webhook settings" 
ON webhook_settings
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create a safe policy for agent collaborators
CREATE POLICY "Agent collaborators can view webhook settings" 
ON webhook_settings
FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'agent'
  )
);

-- Drop ALL existing policies for notification_settings to avoid conflicts
DROP POLICY IF EXISTS "Form owners can manage notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Admin collaborators can manage notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Agent collaborators can view notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Form owners can read notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Form owners can update notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Form owners can insert notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Form owners can delete notification settings" ON notification_settings;

-- Create updated policies for notification_settings
CREATE POLICY "Form owners can manage notification settings" 
ON notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = notification_settings.form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create a safe non-recursive policy for admin collaborators
CREATE POLICY "Admin collaborators can manage notification settings" 
ON notification_settings
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create a safe policy for agent collaborators
CREATE POLICY "Agent collaborators can view notification settings" 
ON notification_settings
FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid() AND role = 'agent'
  )
); 