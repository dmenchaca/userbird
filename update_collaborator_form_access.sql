/*
  # Fix Collaborator Form Access

  This script ensures collaborators can fully access the forms they're invited to.
  It drops and recreates the relevant policies to ensure proper access.
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Allow collaborators to read forms" ON forms;
DROP POLICY IF EXISTS "Allow users to read forms they own or collaborate on" ON forms;

-- Create a more permissive policy for collaborators to read forms
CREATE POLICY "Allow collaborators to read forms"
ON forms FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- Create a combined policy for both owners and collaborators
CREATE POLICY "Allow users to read forms they own or collaborate on"
ON forms FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid() 
  OR 
  id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND invitation_accepted = true
  )
);

-- Ensure the form_collaborators table has proper policies
DROP POLICY IF EXISTS "Users can view forms they are invited to" ON form_collaborators;

CREATE POLICY "Users can view forms they are invited to"
ON form_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Make sure there's no restrictive select privilege on the forms table
GRANT SELECT ON forms TO authenticated;

-- Make sure the function is working properly
DROP FUNCTION IF EXISTS user_has_form_access;

CREATE OR REPLACE FUNCTION user_has_form_access(form_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  -- Check if form_collaborators table exists
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'form_collaborators'
  ) INTO table_exists;

  -- If collaborators table exists, check both owner access and collaborator access
  IF table_exists THEN
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
  ELSE
    -- If collaborators table doesn't exist, just check owner access
    RETURN EXISTS (SELECT 1 FROM forms WHERE id = form_id_param AND owner_id = user_id_param);
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated; 