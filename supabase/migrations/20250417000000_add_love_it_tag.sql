/*
  Add "Love it" tag to feedback_tags table
*/

DO $$ 
BEGIN
  -- Check if feedback_tags table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feedback_tags') THEN
    -- Try to insert the "Love it" tag
    INSERT INTO feedback_tags (name, color, form_id)
    VALUES 
      ('Love it', '#EC4899', NULL)  -- Pink
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$; 