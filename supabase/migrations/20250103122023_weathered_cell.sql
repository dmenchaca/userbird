/*
  # Add system information columns
  
  1. New Columns
    - `operating_system`: Operating system of the user
    - `screen_category`: Device category (Desktop/Mobile/Tablet)
    
  2. Changes
    - Add new columns to feedback table
    - Set default values for existing rows
*/

-- Add new columns
ALTER TABLE feedback
ADD COLUMN operating_system text,
ADD COLUMN screen_category text;

-- Update existing rows with default values
UPDATE feedback 
SET 
  operating_system = 'Unknown',
  screen_category = 'Unknown'
WHERE operating_system IS NULL;

-- Make columns required for new entries
ALTER TABLE feedback
ALTER COLUMN operating_system SET NOT NULL,
ALTER COLUMN screen_category SET NOT NULL;