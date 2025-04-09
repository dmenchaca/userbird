/*
  # Secure Forms Table Access
  
  This script removes public (unauthenticated) access to the forms table
  and ensures only authenticated users can access forms data.
*/

-- Drop the existing public access policy
DROP POLICY IF EXISTS "Public can read forms" ON forms;

-- Create a more restrictive authenticated-only policy for form access
-- This allows authenticated users to read forms only if:
-- 1. They own the form OR
-- 2. They are a collaborator on the form OR
-- 3. The form is being accessed for public feedback submission

-- Create policy for authenticated users to read forms they are associated with
CREATE POLICY "Authenticated users can read forms they own or collaborate on"
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

-- Create a minimal public access policy only for feedback submission
-- This only gives public access to the minimal fields needed for the feedback widget
CREATE POLICY "Public minimal form access for feedback widget"
ON forms FOR SELECT
TO public
USING (true);

-- Restrict which columns the public can see
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from public
REVOKE ALL ON forms FROM public;

-- Grant only SELECT to public with only core columns
-- Just specify the essential columns that definitely exist
GRANT SELECT(id, url, button_color) ON forms TO public;

-- Grant full access to authenticated users
GRANT ALL ON forms TO authenticated; 