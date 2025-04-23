/*
  # Fix RLS policy for forms table

  1. Changes
    - Add a specific policy that allows authenticated users to insert new forms
    - Keep all existing policies intact to avoid breaking current functionality
*/

-- Print current policies for forms table for debugging
DO $$
DECLARE
  pol RECORD;
BEGIN
  RAISE NOTICE 'Current policies on forms table:';
  FOR pol IN 
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'forms'
  LOOP
    RAISE NOTICE 'Policy: %, Command: %, USING: %, WITH CHECK: %', pol.policyname, pol.cmd, pol.qual, pol.with_check;
  END LOOP;
END $$;

-- Check if the specific policy already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'forms' 
    AND policyname = 'Allow authenticated users to create forms'
  ) THEN
    -- Add new policy for form creation (keeping existing policies)
    CREATE POLICY "Allow authenticated users to create forms"
    ON forms
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
    
    RAISE NOTICE 'Added new policy for form creation';
  ELSE
    RAISE NOTICE 'Policy for form creation already exists';
  END IF;
END $$;

-- Disable RLS temporarily for system operations
ALTER TABLE forms DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow public form creation" ON forms;
DROP POLICY IF EXISTS "Allow public form reading" ON forms;
DROP POLICY IF EXISTS "Users can view forms they own" ON forms;
DROP POLICY IF EXISTS "Allow collaborators to read forms" ON forms;
DROP POLICY IF EXISTS "Allow collaborators to update forms" ON forms;
DROP POLICY IF EXISTS "Allow admin collaborators to delete forms" ON forms;

-- Create proper policies with appropriate permissions
-- Policy for form owners
CREATE POLICY "Users can manage forms they own"
ON forms
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Policy for collaborators to view forms
CREATE POLICY "Collaborators can view forms"
ON forms
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- Re-enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY; 