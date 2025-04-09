/*
  # Complete RLS Reset
  
  This script completely resets ALL Row Level Security (RLS) policies and
  recreates them with the simplest possible approach to break any recursion loops.
*/

-- ===== STEP 1: Drop ALL policies on ALL tables =====
DO $$
DECLARE
  table_record RECORD;
  policy_record RECORD;
BEGIN
  -- Loop through tables in the public schema
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    -- Loop through policies for each table
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_record.tablename
    LOOP
      -- Drop the policy
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_record.policyname, table_record.tablename);
    END LOOP;
  END LOOP;
END
$$;

-- ===== STEP 2: Drop all helper functions to avoid any issues =====
DROP FUNCTION IF EXISTS user_has_form_access(TEXT, UUID);
DROP FUNCTION IF EXISTS get_accessible_form_ids();
DROP FUNCTION IF EXISTS get_accessible_form_ids(UUID);
DROP FUNCTION IF EXISTS check_form_access(TEXT, UUID);

-- ===== STEP 3: Create simplified helper function =====
CREATE OR REPLACE FUNCTION user_has_form_access(form_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner check
  RETURN (
    EXISTS (SELECT 1 FROM forms WHERE id = form_id_param AND owner_id = user_id_param)
    OR 
    EXISTS (
      SELECT 1 FROM form_collaborators 
      WHERE form_id = form_id_param 
      AND user_id = user_id_param
      AND invitation_accepted = true
    )
  );
END;
$$;

-- ===== STEP 4: Create minimal policies for essential tables =====

-- Owner can do anything with their forms
CREATE POLICY "Owner can access forms"
ON forms FOR ALL
TO authenticated
USING (owner_id = auth.uid());

-- Public can read forms
CREATE POLICY "Public can read forms"
ON forms FOR SELECT
TO public
USING (true);

-- Collaborators can read forms they're invited to
CREATE POLICY "Collaborators can access forms"
ON forms FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Public can submit feedback
CREATE POLICY "Public can submit feedback"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

-- Public can read all feedback
CREATE POLICY "Public can read feedback"
ON feedback FOR SELECT
TO public
USING (true);

-- Owner can manage feedback
CREATE POLICY "Owner can manage feedback"
ON feedback FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Public can view tags
CREATE POLICY "Public can view tags"
ON feedback_tags FOR SELECT
TO public
USING (true);

-- Owner can manage tags
CREATE POLICY "Owner can manage tags"
ON feedback_tags FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Form owners can manage collaborators
CREATE POLICY "Form owners can manage collaborators"
ON form_collaborators FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Users can view their collaborations
CREATE POLICY "Users can view their collaborations"
ON form_collaborators FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ===== STEP 5: Grant necessary permissions =====
-- Reset all permissions
DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename 
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON %I FROM public', table_record.tablename);
    EXECUTE format('REVOKE ALL ON %I FROM authenticated', table_record.tablename);
  END LOOP;
END
$$;

-- Grant minimal permissions
GRANT SELECT ON forms TO public;
GRANT ALL ON forms TO authenticated;

GRANT INSERT, SELECT ON feedback TO public;
GRANT ALL ON feedback TO authenticated;

GRANT SELECT ON feedback_tags TO public;
GRANT ALL ON feedback_tags TO authenticated;

GRANT SELECT ON form_collaborators TO authenticated;
GRANT INSERT, UPDATE ON form_collaborators TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated; 