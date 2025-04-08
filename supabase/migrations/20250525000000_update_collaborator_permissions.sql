/*
  # Update permissions for collaborators

  1. Changes
    - Update RLS policies for various tables to grant proper access to collaborators
    - Ensure admin collaborators can manage all settings
    - Ensure agent collaborators can view settings but not delete

  2. Security
    - Maintain existing owner-based access control
    - Add collaborator-based access control with role distinctions
*/

-- Update notification_settings policies for collaborators
CREATE POLICY "Admin collaborators can manage notification settings"
ON notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = notification_settings.form_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = notification_settings.form_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Agent collaborators can view notification settings"
ON notification_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = notification_settings.form_id
    AND user_id = auth.uid()
    AND role = 'agent'
  )
);

-- Update webhook_settings policies for collaborators
CREATE POLICY "Admin collaborators can manage webhook settings"
ON webhook_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = webhook_settings.form_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = webhook_settings.form_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Agent collaborators can view webhook settings"
ON webhook_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = webhook_settings.form_id
    AND user_id = auth.uid()
    AND role = 'agent'
  )
);

-- Update feedback policies to allow collaborators to read and respond
CREATE POLICY "Collaborators can read feedback"
ON feedback
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = feedback.form_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Collaborators can update feedback"
ON feedback
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = feedback.form_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    WHERE form_id = feedback.form_id
    AND user_id = auth.uid()
  )
); 