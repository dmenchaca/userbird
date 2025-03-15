/*
  # Fix keyboard shortcut column

  1. Changes
    - Add keyboard_shortcut column if it doesn't exist
    - Update column to handle full shortcut strings
    - Add validation for shortcut format
*/

-- Add keyboard_shortcut column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forms' AND column_name = 'keyboard_shortcut'
  ) THEN
    ALTER TABLE forms ADD COLUMN keyboard_shortcut text;
  END IF;
END $$;

-- Add validation for shortcut format
ALTER TABLE forms
DROP CONSTRAINT IF EXISTS valid_keyboard_shortcut;

ALTER TABLE forms
ADD CONSTRAINT valid_keyboard_shortcut 
CHECK (
  keyboard_shortcut IS NULL OR 
  keyboard_shortcut ~ '^(Control|Alt|Shift|Meta)(\+(Control|Alt|Shift|Meta|\w+|\[\w+\]|\{\w+\}|\(\w+\)))*$'
);