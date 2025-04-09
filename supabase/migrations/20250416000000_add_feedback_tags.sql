/*
  Add and populate feedback tags
*/

DO $$ 
BEGIN
  -- Create the feedback_tags table if it doesn't exist
  CREATE TABLE IF NOT EXISTS feedback_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    color text NOT NULL,
    form_id text REFERENCES forms(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
  );

  -- Add tag_id column to feedback table if it doesn't exist
  ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES feedback_tags(id) ON DELETE SET NULL;

  -- Check if feedback_tags table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_tags') THEN
    -- Add unique constraint to name for ON CONFLICT to work
    ALTER TABLE feedback_tags ADD CONSTRAINT feedback_tags_name_key UNIQUE (name);

    -- Add predefined tags to feedback_tags table
    INSERT INTO feedback_tags (name, color, form_id)
    VALUES 
      ('Bug', '#EF4444', NULL),        -- Red
      ('Data loss', '#7C3AED', NULL),  -- Purple 
      ('Glitch', '#F59E0B', NULL),     -- Amber
      ('New feature', '#10B981', NULL) -- Emerald
    ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Always try to update the feedback policies
  -- Drop the existing policy first
  DROP POLICY IF EXISTS "Users can update their own feedback status" ON feedback;

  -- Create an updated policy that allows updating status and tag_id
  CREATE POLICY "Users can update their own feedback status and tag" 
  ON feedback
  FOR UPDATE 
  USING (auth.uid()::text = user_id) 
  WITH CHECK (auth.uid()::text = user_id);
END $$; 