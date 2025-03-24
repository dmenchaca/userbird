/*
  # Enhance GIF feature

  1. Changes
    - Add gif_urls column to forms table
    - Column is of type text[] to store multiple GIF URLs
    - Default is NULL (no custom GIFs)
    
  2. Notes
    - Works alongside existing show_gif_on_success column
    - Allows forms to have custom GIFs that display randomly
*/

-- Add gif_urls column to forms table
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS gif_urls text[];

-- Check if show_gif_on_success column exists, add if not
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'forms' AND column_name = 'show_gif_on_success'
  ) THEN
    ALTER TABLE forms ADD COLUMN show_gif_on_success boolean DEFAULT false;
  END IF;
END $$; 