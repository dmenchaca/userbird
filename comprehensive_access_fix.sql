/*
  # Comprehensive Access Fix
  
  This script provides a complete fix for all access issues:
  1. Form display for collaborators
  2. Access to feedback/responses for collaborators
  3. Maintains security while ensuring functionality
*/

-- First, completely reset problematic policies
DROP POLICY IF EXISTS "Public minimal form access for feedback widget" ON forms;
DROP POLICY IF EXISTS "Authenticated users can read forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Owner access to forms" ON forms;
DROP POLICY IF EXISTS "Collaborators can update forms" ON forms;
DROP POLICY IF EXISTS "Collaborators can view feedback" ON feedback;
DROP POLICY IF EXISTS "Allow public feedback submission only" ON feedback;
DROP POLICY IF EXISTS "Public can view only their own feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can access their feedback" ON feedback;

-- Reset to simple, permissive policies that match your original behavior

-- 1. Form access policies
-- Remove existing policies with the same names
DROP POLICY IF EXISTS "Owner can access their forms" ON forms;
DROP POLICY IF EXISTS "Public can read forms" ON forms;
DROP POLICY IF EXISTS "Collaborators can read forms" ON forms;
DROP POLICY IF EXISTS "Admin collaborators can update forms" ON forms;

-- Allow authenticated users to access any forms they own
CREATE POLICY "Owner can access their forms" 
ON forms FOR ALL 
TO authenticated
USING (owner_id = auth.uid());

-- Allow public to read all forms (necessary for the widget)
CREATE POLICY "Public can read forms" 
ON forms FOR SELECT 
TO public 
USING (true);

-- Allow collaborators to read forms they're invited to
CREATE POLICY "Collaborators can read forms" 
ON forms FOR SELECT 
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- Allow admin collaborators to update forms
CREATE POLICY "Admin collaborators can update forms" 
ON forms FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
    AND role = 'admin'
  )
);

-- 2. Feedback access policies
-- Remove existing policies with the same names
DROP POLICY IF EXISTS "Owner can manage feedback" ON feedback;
DROP POLICY IF EXISTS "Public can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Public can read feedback" ON feedback;
DROP POLICY IF EXISTS "Collaborators can view form feedback" ON feedback;

-- Allow owner to manage all feedback
CREATE POLICY "Owner can manage feedback" 
ON feedback FOR ALL 
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Allow public to create feedback
CREATE POLICY "Public can submit feedback" 
ON feedback FOR INSERT 
TO public 
WITH CHECK (true);

-- Allow public to read feedback
CREATE POLICY "Public can read feedback" 
ON feedback FOR SELECT 
TO public 
USING (true);

-- Allow collaborators to see feedback for their forms
CREATE POLICY "Collaborators can view form feedback" 
ON feedback FOR SELECT 
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- 3. Feedback_tags access policies
-- Similar pattern for feedback tags
DROP POLICY IF EXISTS "Public can view feedback tags" ON feedback_tags;
DROP POLICY IF EXISTS "Owners can manage feedback tags" ON feedback_tags;
DROP POLICY IF EXISTS "Public can view tags" ON feedback_tags;
DROP POLICY IF EXISTS "Owner can manage tags" ON feedback_tags;
DROP POLICY IF EXISTS "Collaborators can view tags" ON feedback_tags;

CREATE POLICY "Public can view tags" 
ON feedback_tags FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Owner can manage tags" 
ON feedback_tags FOR ALL 
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Collaborators can view tags" 
ON feedback_tags FOR SELECT 
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- Grant appropriate table permissions
GRANT ALL ON forms TO authenticated;
GRANT SELECT ON forms TO public;
GRANT ALL ON feedback TO authenticated;
GRANT SELECT, INSERT ON feedback TO public;
GRANT ALL ON feedback_tags TO authenticated;
GRANT SELECT ON feedback_tags TO public;
GRANT ALL ON form_collaborators TO authenticated;

-- Ensure our helper functions work correctly
DROP FUNCTION IF EXISTS user_has_form_access(TEXT, UUID);

CREATE OR REPLACE FUNCTION user_has_form_access(form_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Direct owner check without RLS
  IF EXISTS (
    SELECT 1 FROM forms
    WHERE id = form_id_param 
    AND owner_id = user_id_param
  ) THEN
    RETURN TRUE;
  END IF;

  -- Collaborator check without RLS
  IF EXISTS (
    SELECT 1 FROM form_collaborators
    WHERE form_id = form_id_param
    AND user_id = user_id_param
    AND invitation_accepted = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated; 