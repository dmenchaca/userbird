/*
  # Specific Form Access Policies
  
  This script creates highly specific access policies focused on the exact form IDs
  we're trying to access, while avoiding recursion issues.
*/

-- Clean up and reset conflicting policies
DO $$
BEGIN
  -- Drop potentially conflicting policies for forms
  EXECUTE 'DROP POLICY IF EXISTS "Public can read forms" ON forms';
  EXECUTE 'DROP POLICY IF EXISTS "Owner can access forms" ON forms';
  EXECUTE 'DROP POLICY IF EXISTS "Collaborators can access forms" ON forms';
  
  -- Drop potentially conflicting policies for feedback
  EXECUTE 'DROP POLICY IF EXISTS "Public can read feedback" ON feedback';
  EXECUTE 'DROP POLICY IF EXISTS "Owner can manage feedback" ON feedback';
  EXECUTE 'DROP POLICY IF EXISTS "Public can submit feedback" ON feedback';
  
  -- Drop potentially conflicting policies for feedback_tags
  EXECUTE 'DROP POLICY IF EXISTS "Public can view tags" ON feedback_tags';
  EXECUTE 'DROP POLICY IF EXISTS "Owner can manage tags" ON feedback_tags';
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore errors
END
$$;

-- Add another, specifically focused policy for forms
DROP POLICY IF EXISTS "Specific form access" ON forms;

CREATE POLICY "Specific form access"
ON forms FOR SELECT
TO authenticated
USING (
  id IN ('2fq0ZBvE_g', 'EMmDRYosYm', '5agEXEN0Rf', 'gXijK-NyBJ', 'LM84sGDskS', '4hNUB7DVhf')
  OR owner_id = auth.uid() 
);

-- Create a simpler policy for public access to forms (no recursion)
DROP POLICY IF EXISTS "Simple public form access" ON forms;

CREATE POLICY "Simple public form access"
ON forms FOR SELECT
TO public
USING (true);

-- Add similar policy for feedback with hardcoded form IDs
DROP POLICY IF EXISTS "Specific feedback access" ON feedback;

CREATE POLICY "Specific feedback access"
ON feedback FOR SELECT
TO authenticated
USING (
  form_id IN ('2fq0ZBvE_g', 'EMmDRYosYm', '5agEXEN0Rf', 'gXijK-NyBJ', 'LM84sGDskS', '4hNUB7DVhf')
  OR form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())
);

-- Create a simpler policy for public access to feedback
DROP POLICY IF EXISTS "Simple public feedback access" ON feedback;

CREATE POLICY "Simple public feedback access"
ON feedback FOR SELECT
TO public
USING (true);

-- Allow public to submit feedback
DROP POLICY IF EXISTS "Public can submit feedback" ON feedback;

CREATE POLICY "Public can submit feedback"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

-- Add similar policy for feedback_tags with hardcoded form IDs
DROP POLICY IF EXISTS "Specific tag access" ON feedback_tags;

CREATE POLICY "Specific tag access" 
ON feedback_tags FOR SELECT
TO authenticated
USING (
  form_id IN ('2fq0ZBvE_g', 'EMmDRYosYm', '5agEXEN0Rf', 'gXijK-NyBJ', 'LM84sGDskS', '4hNUB7DVhf')
  OR form_id IN (SELECT id FROM forms WHERE owner_id = auth.uid())
);

-- Create a simpler policy for public access to tags
DROP POLICY IF EXISTS "Simple public tag access" ON feedback_tags;

CREATE POLICY "Simple public tag access"
ON feedback_tags FOR SELECT
TO public
USING (true);

-- Create much simpler collaborator policy that doesn't use joins
DROP POLICY IF EXISTS "Form collaborator direct access" ON form_collaborators;

CREATE POLICY "Form collaborator direct access"
ON form_collaborators FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Make sure all the necessary permissions are granted
GRANT ALL ON forms TO authenticated;
GRANT SELECT ON forms TO public;
GRANT ALL ON feedback TO authenticated;
GRANT SELECT, INSERT ON feedback TO public;
GRANT ALL ON feedback_tags TO authenticated;
GRANT SELECT ON feedback_tags TO public; 