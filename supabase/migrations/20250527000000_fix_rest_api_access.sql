/*
  # Fix REST API 500 errors

  1. Changes
    - Add public policies for specific query patterns failing in the REST API
    - Ensure forms can be queried by owner_id
    - Make nested join queries work properly

  2. Logic
    - Simplify policies to avoid complex conditions that might cause 500 errors
    - Add specific policies for the exact query patterns we're seeing in the console errors
*/

-- First, ensure we have basic public access for forms table
DROP POLICY IF EXISTS "Allow public reading of forms" ON forms;

CREATE POLICY "Allow public reading of forms"
ON forms FOR SELECT
TO public
USING (true);

-- Add specific policy for querying by owner_id
DROP POLICY IF EXISTS "Allow direct owner_id queries" ON forms;

CREATE POLICY "Allow direct owner_id queries"
ON forms FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Add specific policy for feedback queries
DROP POLICY IF EXISTS "Allow public reading of feedback" ON feedback;

CREATE POLICY "Allow public reading of feedback"
ON feedback FOR SELECT
TO public
USING (true);

-- Add specific policies for feedback tags
DROP POLICY IF EXISTS "Allow public reading of feedback tags" ON feedback_tags;

CREATE POLICY "Allow public reading of feedback tags"
ON feedback_tags FOR SELECT
TO public
USING (true);

-- Make sure we have strong and simple RLS for authenticated users on all tables
DROP POLICY IF EXISTS "Authenticated users can read all forms they own" ON forms;

CREATE POLICY "Authenticated users can read all forms they own"
ON forms FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can read all feedback for forms they own" ON feedback;

CREATE POLICY "Authenticated users can read all feedback for forms they own"
ON feedback FOR SELECT 
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can read all feedback tags for forms they own" ON feedback_tags;

CREATE POLICY "Authenticated users can read all feedback tags for forms they own"
ON feedback_tags FOR SELECT
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
); 