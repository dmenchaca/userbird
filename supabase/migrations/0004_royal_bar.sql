/*
  # Add button color to forms

  1. Changes
    - Add `button_color` column to `forms` table with default value '#1f2937'
    - Add check constraint to ensure valid hex color format
*/

-- Add button_color column with default value
ALTER TABLE forms 
ADD COLUMN IF NOT EXISTS button_color text 
DEFAULT '#1f2937' 
CHECK (button_color ~ '^#[0-9a-fA-F]{6}$');

-- Update existing rows to use default color
UPDATE forms SET button_color = '#1f2937' WHERE button_color IS NULL;