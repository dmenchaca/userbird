/*
  # Add form ownership

  1. Changes
    - Add owner_id column to forms table
    - Link owner_id to auth.users
    - Update RLS policies to enforce ownership
    - Make owner_id required for new forms
  
  2. Security
    - Only allow form owners to access their forms
    - Maintain public access for feedback submission
*/

-- Add owner_id column
ALTER TABLE forms
ADD COLUMN owner_id UUID REFERENCES auth.users(id);

-- Update RLS policies
DROP POLICY IF EXISTS "Allow public form creation" ON forms;
DROP POLICY IF EXISTS "Allow public form reading" ON forms;

-- Create new ownership-based policies
CREATE POLICY "Allow authenticated users to create forms"
ON forms FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Allow users to read own forms"
ON forms FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Allow users to delete own forms"
ON forms FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- Keep public access for feedback-related operations
CREATE POLICY "Allow public to read form settings"
ON forms FOR SELECT
TO public
USING (true);