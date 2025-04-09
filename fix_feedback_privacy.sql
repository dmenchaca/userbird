/*
  # Fix Feedback Privacy
  
  This script restricts public access to feedback data
  while maintaining necessary functionality.
*/

-- Remove the public read access to all feedback
DROP POLICY IF EXISTS "Simple public feedback access" ON feedback;

-- Keep the ability for the public to submit feedback
-- This policy already exists: "Public can submit feedback"

-- Optionally, create a more limited policy for public users to only see their own feedback
-- For example, if you store the submitter's email, you could use that to limit access
-- CREATE POLICY "Public can only read their own feedback"
-- ON feedback FOR SELECT
-- TO public
-- USING (email = nullif(current_setting('request.jwt.claims.email', true), '')::text);

-- Fix feedback tags to only be accessible to authenticated users
DROP POLICY IF EXISTS "Simple public tag access" ON feedback_tags;

-- If you need some tag info for the public widget, create a more specific policy
-- CREATE POLICY "Public can see limited tag info"
-- ON feedback_tags FOR SELECT
-- TO public
-- USING (name IN ('positive', 'negative', 'suggestion'));

-- Ensure permissions are correctly set
REVOKE SELECT ON feedback FROM public;
GRANT INSERT ON feedback TO public; -- Keep ability to submit feedback

REVOKE SELECT ON feedback_tags FROM public; 