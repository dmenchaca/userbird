/*
  # Complete RLS Policy Fix

  This script provides a comprehensive fix for all recursion issues in RLS policies
  by simplifying policies and removing circular dependencies between tables.
*/

-- Step 1: Drop all potentially problematic policies
DROP POLICY IF EXISTS "Allow collaborators to read forms" ON forms;
DROP POLICY IF EXISTS "Allow users to read forms they own or collaborate on" ON forms;
DROP POLICY IF EXISTS "Users can view forms they own" ON forms;
DROP POLICY IF EXISTS "Allow authenticated users to read all forms they own" ON forms;
DROP POLICY IF EXISTS "Authenticated users can read all forms they own" ON forms;
DROP POLICY IF EXISTS "Basic owner access to forms" ON forms;
DROP POLICY IF EXISTS "Collaborator read access to forms" ON forms;
DROP POLICY IF EXISTS "Public can read form settings" ON forms;
DROP POLICY IF EXISTS "Form owners can manage collaborators" ON form_collaborators;
DROP POLICY IF EXISTS "Allow collaborators to view form feedback" ON feedback;
DROP POLICY IF EXISTS "Allow collaborators to view feedback tags" ON feedback_tags;
DROP POLICY IF EXISTS "Authenticated users can read all feedback for forms they own" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can read all feedback tags for forms they own" ON feedback_tags;

-- Step 2: Create simplified access helper functions that don't cause recursion

-- Drop existing functions first
DROP FUNCTION IF EXISTS user_has_form_access(TEXT, UUID);
DROP FUNCTION IF EXISTS get_accessible_form_ids();
DROP FUNCTION IF EXISTS get_accessible_form_ids(UUID);

-- Function to check if a user has access to a form
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

-- Function to get all form IDs a user has access to
CREATE OR REPLACE FUNCTION get_accessible_form_ids(user_id_param UUID DEFAULT auth.uid())
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  form_ids TEXT[];
BEGIN
  -- Get all form IDs the user owns or collaborates on
  SELECT ARRAY(
    SELECT id FROM forms WHERE owner_id = user_id_param
    UNION
    SELECT form_id FROM form_collaborators 
    WHERE user_id = user_id_param AND invitation_accepted = true
  ) INTO form_ids;
  
  RETURN form_ids;
END;
$$;

-- Step 3: Grant execute permissions
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_form_ids TO authenticated;

-- Step 4: Create simplified policies for forms

-- Basic owner policy
CREATE POLICY "Owner access to forms"
ON forms FOR ALL
TO authenticated
USING (owner_id = auth.uid());

-- Simple public access policy
CREATE POLICY "Public can read forms"
ON forms FOR SELECT
TO public
USING (true);

-- Step 5: Create non-recursive policies for form_collaborators

-- Policy for collaborators to view their collaborations
CREATE POLICY "Users can view their collaborations"
ON form_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy for form owners to manage collaborators
CREATE POLICY "Form owners can manage collaborators"
ON form_collaborators
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE id = form_collaborators.form_id
    AND owner_id = auth.uid()
  )
);

-- Step 6: Create policies for feedback that avoid recursion

-- Public can create feedback
CREATE POLICY "Public can create feedback"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

-- Owner can manage feedback
CREATE POLICY "Owners can manage feedback"
ON feedback FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Public can view feedback
CREATE POLICY "Public can view feedback"
ON feedback FOR SELECT
TO public
USING (true);

-- Step 7: Create policies for feedback_tags that avoid recursion

-- Owner can manage feedback tags
CREATE POLICY "Owners can manage feedback tags"
ON feedback_tags FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Public can view feedback tags
CREATE POLICY "Public can view feedback tags"
ON feedback_tags FOR SELECT
TO public
USING (true); 