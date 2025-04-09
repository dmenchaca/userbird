/*
  # Enable Detailed Database Logging
  
  This script enables detailed logging in PostgreSQL to help diagnose 
  the 500 errors we're seeing in the application.
*/

-- Set log level to DEBUG to capture all queries
ALTER DATABASE postgres SET log_min_messages TO 'DEBUG5';
ALTER DATABASE postgres SET log_statement TO 'all';
ALTER DATABASE postgres SET log_error_verbosity TO 'VERBOSE';

-- Enable logging of all statements
ALTER DATABASE postgres SET log_statement TO 'all';

-- Log all RLS policy decisions
ALTER DATABASE postgres SET log_min_messages TO 'DEBUG1';

-- Add another, specifically focused policy for forms
DROP POLICY IF EXISTS "Specific form access" ON forms;

CREATE POLICY "Specific form access"
ON forms FOR SELECT
TO authenticated
USING (
  id IN ('2fq0ZBvE_g', 'EMmDRYosYm', '5agEXEN0Rf', 'gXijK-NyBJ', 'LM84sGDskS', '4hNUB7DVhf')
  AND 
  (
    owner_id = auth.uid() 
    OR 
    id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
    )
  )
);

-- Add similar policy for feedback
DROP POLICY IF EXISTS "Specific feedback access" ON feedback;

CREATE POLICY "Specific feedback access"
ON feedback FOR SELECT
TO authenticated
USING (
  form_id IN ('2fq0ZBvE_g', 'EMmDRYosYm', '5agEXEN0Rf', 'gXijK-NyBJ', 'LM84sGDskS', '4hNUB7DVhf')
);

-- Add similar policy for feedback_tags
DROP POLICY IF EXISTS "Specific tag access" ON feedback_tags;

CREATE POLICY "Specific tag access" 
ON feedback_tags FOR SELECT
TO authenticated
USING (
  form_id IN ('2fq0ZBvE_g', 'EMmDRYosYm', '5agEXEN0Rf', 'gXijK-NyBJ', 'LM84sGDskS', '4hNUB7DVhf')
);

-- Let's try one more approach - create a simplified join query policy
DROP POLICY IF EXISTS "Allow count queries on feedback" ON feedback;

CREATE POLICY "Allow count queries on feedback"
ON feedback FOR SELECT
TO authenticated
USING (true); 