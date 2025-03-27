/*
  # Update default settings for forms 

  1. Changes
    - Change show_gif_on_success default to true instead of false
    - Set keyboard_shortcut default to 'L'
    - Set default GIF URLs for all new forms
    - Enable sound by default
  
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

-- Enable sound by default
ALTER TABLE forms
ALTER COLUMN sound_enabled SET DEFAULT true;

-- Set default GIFs for gif_urls column
ALTER TABLE forms 
ALTER COLUMN gif_urls SET DEFAULT ARRAY[
  'https://media1.tenor.com/m/TqHquUQoqu8AAAAd/you%27re-a-lifesaver-dove.gif',
  'https://media1.tenor.com/m/4PLfYPBvjhQAAAAd/tannerparty-tanner.gif',
  'https://media1.tenor.com/m/lRY5I7kwR08AAAAd/brooklyn-nine-nine-amy-and-rosa.gif',
  'https://media1.tenor.com/m/9LbEpuHBPScAAAAd/brooklyn-nine-nine-amy-and-rosa.gif',
  'https://media1.tenor.com/m/mnx8ECSie6EAAAAd/sheldon-cooper-big-bang-theory.gif'
]::text[]; 