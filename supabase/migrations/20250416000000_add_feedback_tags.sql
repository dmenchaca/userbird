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

-- Drop the existing policy first
DROP POLICY IF EXISTS "Users can update their own feedback status" ON feedback;

-- Create an updated policy that allows updating status and tag_id
CREATE POLICY "Users can update their own feedback status and tag" 
ON feedback
FOR UPDATE 
USING (auth.uid()::text = user_id) 
WITH CHECK (auth.uid()::text = user_id); 