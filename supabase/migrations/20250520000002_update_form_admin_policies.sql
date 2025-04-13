/*
  # Update form policies for admins
  
  1. Changes
    - Define admin access solely based on form_collaborators with role='admin'
    - Ensures admins can view, create, and update forms
    - Owners (owner_id = auth.uid()) can delete their forms
    
  2. Security
    - Defines admin access strictly based on form_collaborators with role='admin'
    - Owners have special permission to delete their own forms
*/

-- First, ensure existing policies don't cause conflicts
DO $$
BEGIN
  -- Drop potentially conflicting delete policies temporarily
  DROP POLICY IF EXISTS "Allow users to delete own forms" ON forms;
  DROP POLICY IF EXISTS "Allow admin collaborators to delete forms" ON forms;

  -- We'll create new deletion policies
END $$;

-- Create deletion policies:
-- 1. Owner can delete their forms
CREATE POLICY "Allow owners to delete their forms"
ON forms FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Add comment to document policy intention on forms table
COMMENT ON TABLE forms IS 'Feedback forms with RLS policies: Owners can delete their forms. Admin role is defined in form_collaborators table.';

-- Ensure update and select policies exist for admins
DO $$
BEGIN
  -- Check if the admin update policy already exists
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow admins to update forms'
  ) THEN
    CREATE POLICY "Allow admins to update forms"
    ON forms FOR UPDATE
    TO authenticated
    USING (
      id IN (
        SELECT form_id FROM form_collaborators
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
    WITH CHECK (
      id IN (
        SELECT form_id FROM form_collaborators
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  END IF;

  -- Ensure read access is properly set
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow admins to read forms'
  ) THEN
    CREATE POLICY "Allow admins to read forms"
    ON forms FOR SELECT
    TO authenticated
    USING (
      id IN (
        SELECT form_id FROM form_collaborators
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  END IF;
END $$;

-- Ensure admins can insert forms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow admins to create forms'
  ) THEN
    CREATE POLICY "Allow admins to create forms"
    ON forms FOR INSERT
    TO authenticated
    WITH CHECK (
      -- For new forms, we need to ensure the user is an admin
      -- Since the form doesn't exist yet, we check if the user is an admin for any form
      EXISTS (
        SELECT 1 FROM form_collaborators
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  END IF;
END $$;

-- Comment on the forms table to document policy
COMMENT ON TABLE forms IS 'Feedback forms with RLS policies: Admins (defined by role=admin in form_collaborators) can read, create, and update forms. Owners can delete directly.'; 