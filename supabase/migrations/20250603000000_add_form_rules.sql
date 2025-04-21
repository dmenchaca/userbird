/*
  Add custom rules field to forms table for AI response customization
*/

BEGIN;

-- Add rules column to forms table if it doesn't exist
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS rules text;

-- Add comment to explain the purpose of the rules column
COMMENT ON COLUMN forms.rules IS 'Custom instructions for AI responses that override default behavior while maintaining core formatting';

-- Update Studio permissions
GRANT ALL ON forms TO authenticated;
GRANT SELECT ON forms TO anon;

COMMIT; 