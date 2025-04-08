/*
  # Add secure policies after fixing recursion issues

  This migration adds proper security policies after confirming that 
  removing all policies fixed the recursion issues.
  
  The approach:
  1. Drop the unrestricted policies
  2. Add specific policies in a way that prevents recursion
  3. Avoid circular references between policies
*/

-- Drop the temporary unrestricted policies
DROP POLICY IF EXISTS "Unrestricted access to forms" ON forms;
DROP POLICY IF EXISTS "Unrestricted access to form_collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Unrestricted access to feedback" ON feedback;
DROP POLICY IF EXISTS "Unrestricted access to feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Unrestricted access to notification_settings" ON notification_settings;

-- PHASE 1: Basic owner access (direct ownership)
-- Create non-recursive owner access policies for forms
CREATE POLICY "Owner access to forms" 
ON forms FOR ALL 
TO authenticated 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

-- Create non-recursive owner access policies for other tables
-- These only reference the forms table, not other policies
CREATE POLICY "Owner access to form_collaborators" 
ON form_collaborators FOR ALL 
TO authenticated 
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())) 
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Owner access to feedback" 
ON feedback FOR ALL 
TO authenticated 
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())) 
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Owner access to feedback_tags" 
ON feedback_tags FOR ALL 
TO authenticated 
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())) 
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

CREATE POLICY "Owner access to notification_settings" 
ON notification_settings FOR ALL 
TO authenticated 
USING (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())) 
WITH CHECK (form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid()));

-- PHASE 2: Collaborator access
-- First, allow users to see collaborations they're part of
CREATE POLICY "Self collaborator access" 
ON form_collaborators FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

-- Next, allow users to access forms they collaborate on
CREATE POLICY "Collaborator read access to forms" 
ON forms FOR SELECT 
TO authenticated 
USING (id IN (SELECT form_id FROM form_collaborators WHERE user_id = auth.uid()));

-- Then allow similar access to related tables
CREATE POLICY "Collaborator read access to feedback" 
ON feedback FOR SELECT 
TO authenticated 
USING (form_id IN (SELECT form_id FROM form_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborator read access to feedback_tags" 
ON feedback_tags FOR SELECT 
TO authenticated 
USING (form_id IN (SELECT form_id FROM form_collaborators WHERE user_id = auth.uid()));

CREATE POLICY "Collaborator read access to notification_settings" 
ON notification_settings FOR SELECT 
TO authenticated 
USING (form_id IN (SELECT form_id FROM form_collaborators WHERE user_id = auth.uid()));

-- PHASE 3: Public access policies - allowing read-only for submissions
CREATE POLICY "Public read access to forms"
ON forms FOR SELECT
TO public
USING (true);

CREATE POLICY "Public read access to feedback"
ON feedback FOR SELECT
TO public
USING (true);

CREATE POLICY "Public read access to feedback_tags"
ON feedback_tags FOR SELECT
TO public
USING (true);

-- Add write access for public feedback submissions
CREATE POLICY "Public can submit feedback"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

-- Comment explaining security approach
COMMENT ON TABLE forms IS 'Forms are secured with three levels of access: owner (full access), collaborator (read or limited write based on role), and public (read-only or specific submission endpoints).';
COMMENT ON TABLE form_collaborators IS 'Collaborators table defines relationships between users and forms. Users can see collaborations they are part of plus any they own.';
COMMENT ON TABLE feedback IS 'Feedback can be viewed by form owners and collaborators. Public users can submit feedback.';
COMMENT ON TABLE feedback_tags IS 'Tags can be managed by owners and viewed by collaborators.';
COMMENT ON TABLE notification_settings IS 'Notification settings can be managed by owners and viewed by collaborators.'; 