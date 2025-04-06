/*
  # Add form-specific tags support
  
  1. Changes
    - Modify feedback_tags to support per-form custom tags
    - Replace name uniqueness constraint with per-form uniqueness
    - Add RLS policies for tag management
    
  This allows form owners to create custom tags for their specific forms,
  while still maintaining global tags across all forms.
*/

-- 1. First remove the existing constraint on name
ALTER TABLE feedback_tags DROP CONSTRAINT IF EXISTS feedback_tags_name_key;

-- 2. Create a compound unique constraint for name+form_id
-- This allows the same tag name to exist for different forms
-- For NULL form_id (global tags), we use a specific index approach
CREATE UNIQUE INDEX feedback_tags_name_form_idx ON feedback_tags (name, (form_id::text)) WHERE form_id IS NOT NULL;
CREATE UNIQUE INDEX feedback_tags_global_name_idx ON feedback_tags (name) WHERE form_id IS NULL;

-- 3. Update RLS policies for feedback_tags
-- First drop existing policies if any
DROP POLICY IF EXISTS "Users can manage form tags" ON feedback_tags;
DROP POLICY IF EXISTS "Users can view global and form tags" ON feedback_tags;

-- 4. Enable RLS on feedback_tags if not already enabled
ALTER TABLE feedback_tags ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for feedback_tags
-- Allow viewing global tags and tags for forms the user owns
CREATE POLICY "Users can view global and form tags" 
ON feedback_tags
FOR SELECT 
USING (
  form_id IS NULL OR 
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.owner_id = auth.uid()
  )
);

-- Allow creating/editing tags for forms the user owns
CREATE POLICY "Users can manage form tags" 
ON feedback_tags
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms 
    WHERE forms.id = form_id 
    AND forms.owner_id = auth.uid()
  )
);

-- 6. Update feedback table policy for tag_id
-- This ensures users can only link feedback to global tags or tags for their form
CREATE POLICY "Allow feedback to use appropriate tags" 
ON feedback
FOR UPDATE 
USING (
  tag_id IS NULL OR
  EXISTS (
    SELECT 1 FROM feedback_tags
    WHERE feedback_tags.id = tag_id AND (
      feedback_tags.form_id IS NULL OR
      feedback_tags.form_id = form_id
    )
  )
)
WITH CHECK (
  tag_id IS NULL OR
  EXISTS (
    SELECT 1 FROM feedback_tags
    WHERE feedback_tags.id = tag_id AND (
      feedback_tags.form_id IS NULL OR
      feedback_tags.form_id = form_id
    )
  )
); 