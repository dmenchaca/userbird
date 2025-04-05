-- Add "Love it" tag to feedback_tags table
INSERT INTO feedback_tags (name, color, form_id)
VALUES 
  ('Love it', '#EC4899', NULL)  -- Pink
ON CONFLICT (name) DO NOTHING; 