/*
  # Add support text to forms

  1. Changes
    - Add support_text column to forms table
    - Support text is optional and can contain markdown links
*/

-- Add support_text column
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS support_text text;