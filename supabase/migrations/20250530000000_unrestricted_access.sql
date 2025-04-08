/*
  # Temporary unrestricted access to fix production issues

  This migration reverts to the unrestricted access approach that worked previously.
  Further investigation will be needed to determine why even the simplified policies
  are still causing recursion issues.
  
  IMPORTANT: This is a TEMPORARY solution for production stability.
  Security will need to be re-implemented carefully after root cause analysis.
*/

-- Disable RLS on all tables to clear any state
ALTER TABLE forms DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies from both previous migrations
DROP POLICY IF EXISTS "Unrestricted access to forms" ON forms;
DROP POLICY IF EXISTS "Unrestricted access to form_collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Unrestricted access to feedback" ON feedback;
DROP POLICY IF EXISTS "Unrestricted access to feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Unrestricted access to notification_settings" ON notification_settings;

DROP POLICY IF EXISTS "Owner access to forms" ON forms;
DROP POLICY IF EXISTS "Owner access to form_collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Owner access to feedback" ON feedback;
DROP POLICY IF EXISTS "Owner access to feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Owner access to notification_settings" ON notification_settings;

DROP POLICY IF EXISTS "Self collaborator access" ON form_collaborators;
DROP POLICY IF EXISTS "Collaborator read access to forms" ON forms;
DROP POLICY IF EXISTS "Collaborator read access to feedback" ON feedback;
DROP POLICY IF EXISTS "Collaborator read access to feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Collaborator read access to notification_settings" ON notification_settings;

DROP POLICY IF EXISTS "Public read access to forms" ON forms;
DROP POLICY IF EXISTS "Public read access to feedback" ON feedback;
DROP POLICY IF EXISTS "Public read access to feedback_tags" ON feedback_tags;
DROP POLICY IF EXISTS "Public can submit feedback" ON feedback;

-- Re-enable RLS on tables to ensure policies will be applied
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create completely unrestricted policies that we know work in production
CREATE POLICY "Unrestricted access to forms" 
ON forms FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Unrestricted access to form_collaborators" 
ON form_collaborators FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Unrestricted access to feedback" 
ON feedback FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Unrestricted access to feedback_tags" 
ON feedback_tags FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Unrestricted access to notification_settings" 
ON notification_settings FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- Add a database comment to explain this situation
COMMENT ON DATABASE postgres IS 'WARNING: RLS policies are currently set to allow unrestricted access for stability. Security audit needed.'; 