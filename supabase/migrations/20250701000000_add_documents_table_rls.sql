/*
  # Add Row Level Security to documents table
  
  1. Changes
    - Enable Row Level Security on documents table
    - Add policy that restricts all operations to service role only
    - Add policy for read-only access to form collaborators (both admins and agents)
  
  2. Security
    - Only service role can insert, update, or delete documents
    - Form collaborators (admins and agents) can read documents for their forms
*/

-- First check if RLS is already enabled, and if not, enable it
DO $$
BEGIN
  -- Check if RLS is enabled on the documents table
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'documents' 
    AND rowsecurity = TRUE
  ) THEN
    -- Enable RLS
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Row Level Security enabled on documents table';
  ELSE
    RAISE NOTICE 'Row Level Security was already enabled on documents table';
  END IF;
END $$;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Service role only for documents" ON documents;
DROP POLICY IF EXISTS "Form collaborators can read documents" ON documents;

-- Create policies for the documents table

-- Policy 1: Only service role can modify the documents table
CREATE POLICY "Service role only for documents" 
ON documents
FOR ALL 
TO authenticated
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Policy 2: Collaborators (admins and agents) can read documents for their forms
CREATE POLICY "Form collaborators can read documents" 
ON documents
FOR SELECT 
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
  )
);

-- Add comment to document the security model
COMMENT ON TABLE documents IS 'Stores document chunks with embeddings for AI retrieval. Secured with RLS: only service role can modify, while form collaborators (admins and agents) can read their own documents.'; 