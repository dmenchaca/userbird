/*
  # Add default tags to all existing forms
  
  1. Changes
    - Add the standard set of 5 tags to all existing forms
    - Set all form-specific tags as favorites by default
    
  This ensures all forms have their own tag sets following the
  transition from global tags to form-specific tags.
*/

-- First create a temporary table with all the tag combinations we need
CREATE TEMP TABLE temp_form_tags AS
SELECT
  forms.id as form_id,
  tag_names.name as name,
  tag_names.color as color
FROM
  forms
CROSS JOIN (
  VALUES
    ('⚠️ Bug', '#EF4444'),       -- Red
    ('☠️ Data loss', '#7C3AED'), -- Purple 
    ('🫤 Glitch', '#F59E0B'),    -- Amber
    ('🚀 New feature', '#10B981'), -- Emerald
    ('❤️ Love it', '#EC4899')    -- Pink
) AS tag_names(name, color);

-- Insert tags for each form, skipping any that already exist
INSERT INTO feedback_tags (name, color, form_id, is_favorite)
SELECT 
  temp.name,
  temp.color,
  temp.form_id,
  TRUE as is_favorite
FROM 
  temp_form_tags temp
LEFT JOIN 
  feedback_tags existing 
  ON existing.name = temp.name 
  AND existing.form_id = temp.form_id
WHERE 
  existing.id IS NULL;

-- Update tag references in feedback table
-- For each piece of feedback that references a global tag,
-- update it to use the form-specific tag with the same name
UPDATE feedback f
SET tag_id = form_tags.id
FROM 
  feedback_tags AS global_tags,
  feedback_tags AS form_tags 
WHERE 
  f.tag_id = global_tags.id
  AND global_tags.form_id IS NULL
  AND form_tags.form_id = f.form_id
  AND form_tags.name = global_tags.name;

-- Drop the temporary table
DROP TABLE temp_form_tags; 