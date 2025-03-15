/*
  # Add keyboard shortcut to forms

  1. Changes
    - Add keyboard_shortcut column to forms table
    - Column is nullable since it's an optional feature
    
  2. Notes
    - Stores keyboard shortcut combinations like "Control+Shift+F"
*/

-- Add keyboard_shortcut column if it doesn't exist
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS keyboard_shortcut text;