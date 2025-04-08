/*
  # Fix RLS policies for compatibility

  1. Changes
    - Update policies to ensure existing owner_id queries continue to work
    - Fix compatibility issues between old and new access patterns
    - Ensure queries don't cause 500 errors 

  2. Logic
    - Drop conflicting policies
    - Recreate policies with more specific conditions
    - Ensure backward compatibility
*/

-- First, drop all potentially conflicting policies including the ones we are about to create
DROP POLICY IF EXISTS "Allow users to read own forms" ON forms;
DROP POLICY IF EXISTS "Allow collaborators to read forms" ON forms;
DROP POLICY IF EXISTS "Allow users to update own forms" ON forms;
DROP POLICY IF EXISTS "Allow collaborators to update forms" ON forms;
DROP POLICY IF EXISTS "Allow admin collaborators to delete forms" ON forms;
DROP POLICY IF EXISTS "Allow users to delete own forms" ON forms;
DROP POLICY IF EXISTS "Allow users to read forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Allow users to update forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Allow owners and admin collaborators to delete forms" ON forms;

-- Create combined policy that checks both owner_id and collaborators
CREATE POLICY "Allow users to read forms they own or collaborate on"
ON forms FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR 
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Create combined update policy
CREATE POLICY "Allow users to update forms they own or collaborate on"
ON forms FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR 
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  owner_id = auth.uid() 
  OR 
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Create combined delete policy for owners and admin collaborators
CREATE POLICY "Allow owners and admin collaborators to delete forms"
ON forms FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR 
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Fix feedback access policies
DROP POLICY IF EXISTS "Allow users to view form feedback" ON feedback;
DROP POLICY IF EXISTS "Collaborators can read feedback" ON feedback;
DROP POLICY IF EXISTS "Allow collaborators to update feedback" ON feedback;
DROP POLICY IF EXISTS "Allow admin collaborators to delete feedback" ON feedback;
DROP POLICY IF EXISTS "Allow users to view feedback for forms they own or collaborate on" ON feedback;
DROP POLICY IF EXISTS "Allow users to update feedback for forms they own or collaborate on" ON feedback;
DROP POLICY IF EXISTS "Allow owners and admin collaborators to delete feedback" ON feedback;

-- Create combined feedback access policy
CREATE POLICY "Allow users to view feedback for forms they own or collaborate on"
ON feedback FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
    )
  )
);

-- Add update policy for feedback
CREATE POLICY "Allow users to update feedback for forms they own or collaborate on"
ON feedback FOR UPDATE
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
    )
  )
);

-- Add delete policy for feedback (owners and admin collaborators only)
CREATE POLICY "Allow owners and admin collaborators to delete feedback"
ON feedback FOR DELETE
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Fix feedback tags access
DROP POLICY IF EXISTS "Users can view their form tags" ON feedback_tags;
DROP POLICY IF EXISTS "Users can manage their form tags" ON feedback_tags;
DROP POLICY IF EXISTS "Users can view tags for forms they own or collaborate on" ON feedback_tags;
DROP POLICY IF EXISTS "Users can manage tags for forms they own or are admins of" ON feedback_tags;

CREATE POLICY "Users can view tags for forms they own or collaborate on"
ON feedback_tags FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can manage tags for forms they own or are admins of"
ON feedback_tags
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
)
WITH CHECK (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- For other related tables, make sure they have similar combined policies
-- Notification settings
DROP POLICY IF EXISTS "Users can manage their form notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Admin collaborators can manage notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Agent collaborators can view notification settings" ON notification_settings;
DROP POLICY IF EXISTS "Users can manage notification settings for forms they own or are admins of" ON notification_settings;
DROP POLICY IF EXISTS "Users can view notification settings for forms they collaborate on as agents" ON notification_settings;

CREATE POLICY "Users can manage notification settings for forms they own or are admins of"
ON notification_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = notification_settings.form_id
    AND (
      forms.owner_id = auth.uid()
      OR 
      EXISTS (
        SELECT 1 
        FROM form_collaborators
        WHERE form_id = notification_settings.form_id
        AND user_id = auth.uid()
        AND role = 'admin'
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = notification_settings.form_id
    AND (
      forms.owner_id = auth.uid()
      OR 
      EXISTS (
        SELECT 1 
        FROM form_collaborators
        WHERE form_id = notification_settings.form_id
        AND user_id = auth.uid()
        AND role = 'admin'
      )
    )
  )
);

CREATE POLICY "Users can view notification settings for forms they collaborate on as agents"
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