/*
  # Add form ownership

  1. Changes
    - Add owner_id column to forms table
    - Update RLS policies to enforce ownership
    - Keep public access for feedback submission
  
  2. Security
    - Only authenticated users can create forms
    - Users can only access their own forms
    - Public access maintained for feedback submission
*/

-- Add owner_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forms' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE forms ADD COLUMN owner_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Update RLS policies
DROP POLICY IF EXISTS "Allow public form creation" ON forms;
DROP POLICY IF EXISTS "Allow public form reading" ON forms;

-- Create new ownership-based policies conditionally
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow authenticated users to create forms'
  ) THEN
    -- Create the policy
    CREATE POLICY "Allow authenticated users to create forms"
    ON forms FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());
  END IF;

  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow users to read own forms'
  ) THEN
    -- Create the policy
    CREATE POLICY "Allow users to read own forms"
    ON forms FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid());
  END IF;

  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow users to delete own forms'
  ) THEN
    -- Create the policy
    CREATE POLICY "Allow users to delete own forms"
    ON forms FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid());
  END IF;

  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'forms'
    AND policyname = 'Allow public to read form settings'
  ) THEN
    -- Create the policy
    CREATE POLICY "Allow public to read form settings"
    ON forms FOR SELECT
    TO public
    USING (true);
  END IF;
END
$$;