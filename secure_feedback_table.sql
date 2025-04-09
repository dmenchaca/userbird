/*
  # Secure Feedback Table Access
  
  This script restricts public access to the feedback table
  while maintaining necessary functionality for feedback submission.
*/

-- First, drop all existing public policies on the feedback table
DROP POLICY IF EXISTS "Public can view feedback" ON feedback;
DROP POLICY IF EXISTS "Public can read feedback" ON feedback;
DROP POLICY IF EXISTS "Public can create feedback" ON feedback;
DROP POLICY IF EXISTS "Public can submit feedback" ON feedback;
DROP POLICY IF EXISTS "Public minimal form access for feedback widget" ON feedback;

-- Also drop any overlapping authenticated policies
DROP POLICY IF EXISTS "Owners can manage feedback" ON feedback;
DROP POLICY IF EXISTS "Authenticated users can access their feedback" ON feedback;

-- Create a more specific policy for public feedback submission
CREATE POLICY "Allow public feedback submission only"
ON feedback FOR INSERT
TO public
WITH CHECK (true);

-- Create policy for authenticated users to access feedback
CREATE POLICY "Authenticated users can access their feedback"
ON feedback FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms 
    WHERE owner_id = auth.uid()
    OR
    id IN (
      SELECT form_id FROM form_collaborators
      WHERE user_id = auth.uid()
      AND invitation_accepted = true
    )
  )
);

-- Restrict public viewing of feedback data
-- Note: We're not using a secret_id since that column doesn't exist
-- Instead, we'll completely restrict public SELECT access

-- Restrict which columns the public can see for submitted feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from public
REVOKE ALL ON feedback FROM public;

-- Grant only INSERT to public for submitting feedback
GRANT INSERT ON feedback TO public;

-- Grant full access to authenticated users
GRANT ALL ON feedback TO authenticated; 