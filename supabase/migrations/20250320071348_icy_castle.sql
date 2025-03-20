/*
  # Add sound notification feature

  1. Changes
    - Add sound_enabled column to forms table
    - Default value set to false
    - Add to existing form settings
  
  2. Notes
    - Simple boolean flag to control sound notifications
    - Maintains existing RLS policies
*/

-- Add sound_enabled column with default value
ALTER TABLE forms
ADD COLUMN sound_enabled boolean DEFAULT false;