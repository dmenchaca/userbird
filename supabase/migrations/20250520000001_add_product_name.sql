/*
  # Add product_name to forms

  1. Changes
    - Add product_name column to forms table
    - Column is nullable since it will be populated gradually
    
  2. Notes
    - Will show form URL if product_name is not set
    - Used to show user-friendly names in the dropdown
*/

-- Add product_name column to forms table
ALTER TABLE forms ADD COLUMN product_name text;

-- Add comment to the column for documentation
COMMENT ON COLUMN forms.product_name IS 'Human-readable product name that appears in the dropdown'; 