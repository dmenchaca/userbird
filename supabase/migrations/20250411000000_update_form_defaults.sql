/*
  # Update default settings for forms 

  1. Changes
    - Change show_gif_on_success default to true instead of false
    - Set keyboard_shortcut default to 'L'
  
  2. Notes
    - Updates defaults for all new forms
    - Doesn't affect existing forms
*/

-- Update show_gif_on_success default to true
ALTER TABLE forms 
ALTER COLUMN show_gif_on_success SET DEFAULT true;

-- Update keyboard_shortcut default to 'L'
ALTER TABLE forms 
ALTER COLUMN keyboard_shortcut SET DEFAULT 'L';

-- We don't set a default for gif_urls as it's an array
-- The application code will handle setting the default values 