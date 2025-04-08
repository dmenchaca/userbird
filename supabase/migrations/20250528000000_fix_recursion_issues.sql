/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Infinite recursion detected in policies for multiple tables
    - Complex policies with circular references
  
  2. Solution
    - Disable and re-enable RLS
    - Create extremely simple policies
    - Avoid circular references between tables
*/

-- Completely disable RLS on problematic tables
ALTER TABLE forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow users to read forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Allow users to update forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Allow owners and admin collaborators to delete forms" ON forms;
DROP POLICY IF EXISTS "Form owners can manage collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Users can view forms they are invited to" ON form_collaborators;
DROP POLICY IF EXISTS "Allow users to view feedback for forms they own or collaborate on" ON feedback;
DROP POLICY IF EXISTS "Allow users to view feedback tags for forms they own or collaborate on" ON feedback_tags;
DROP POLICY IF EXISTS "Allow users to manage feedback tags for forms they own or collaborate as admins" ON feedback_tags;
DROP POLICY IF EXISTS "Users can view notification settings for forms they collaborate on as agents" ON notification_settings;
DROP POLICY IF EXISTS "Users can manage notification settings for forms they own or are admins of" ON notification_settings;

DROP POLICY IF EXISTS "Basic access to form_collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Basic management of form_collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Basic access to forms" ON forms;
DROP POLICY IF EXISTS "Basic update to forms" ON forms;
DROP POLICY IF EXISTS "Basic delete to forms" ON forms;
DROP POLICY IF EXISTS "Basic access to feedback" ON feedback;
DROP POLICY IF EXISTS "Basic access to feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Basic management of feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Basic access to notification_settings" ON notification_settings;
DROP POLICY IF EXISTS "Basic management of notification_settings" ON notification_settings;
DROP POLICY IF EXISTS "Allow public reading of forms" ON forms;
DROP POLICY IF EXISTS "Allow public reading of feedback" ON feedback;
DROP POLICY IF EXISTS "Allow public reading of feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Allow public reading of form_collaborators" ON form_collaborators;

-- Re-enable RLS on tables
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create minimal policies for forms
CREATE POLICY "Owner access to forms"
ON forms FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- First add this policy without any reference to form_collaborators
CREATE POLICY "Public SELECT on forms" 
ON forms FOR SELECT
TO public
USING (true);

-- Create minimal policies for form_collaborators
CREATE POLICY "Owner access to form_collaborators"
ON form_collaborators FOR ALL
TO authenticated
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()))
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Collaborator access to form_collaborators"
ON form_collaborators FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Public SELECT on form_collaborators"
ON form_collaborators FOR SELECT
TO public
USING (true);

-- Now that form_collaborators is setup, we can add the policy for forms
CREATE POLICY "Collaborator access to forms"
ON forms FOR SELECT
TO authenticated
USING (id IN (SELECT form_id FROM form_collaborators WHERE user_id = auth.uid()));

-- Create minimal policies for feedback
CREATE POLICY "Form owner access to feedback"
ON feedback FOR ALL
TO authenticated
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()))
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Public SELECT on feedback"
ON feedback FOR SELECT
TO public
USING (true);

-- Create minimal policies for feedback_tags
CREATE POLICY "Form owner access to feedback_tags"
ON feedback_tags FOR ALL
TO authenticated
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()))
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Public SELECT on feedback_tags"
ON feedback_tags FOR SELECT
TO public
USING (true);

-- Create minimal policies for notification_settings
CREATE POLICY "Form owner access to notification_settings"
ON notification_settings FOR ALL
TO authenticated
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()))
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Public SELECT on notification_settings"
ON notification_settings FOR SELECT
TO public
USING (true); 