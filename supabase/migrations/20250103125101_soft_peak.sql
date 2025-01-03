/*
  # Add image support to feedback table

  1. Changes
    - Add image_url column to feedback table
    - Add image_name column for original filename
    - Add image_size column to track file sizes
    - Add constraint to ensure image_size is under 5MB
    - Add constraint to validate image extensions

  2. Notes
    - Maximum file size: 5MB
    - Supported formats: .jpg, .jpeg, .png
*/

-- Add image-related columns
ALTER TABLE feedback
ADD COLUMN image_url text,
ADD COLUMN image_name text,
ADD COLUMN image_size integer;

-- Add constraints
ALTER TABLE feedback
ADD CONSTRAINT valid_image_size 
  CHECK (image_size IS NULL OR image_size <= 5242880), -- 5MB in bytes
ADD CONSTRAINT valid_image_extension 
  CHECK (
    image_name IS NULL OR 
    image_name ~* '.*\.(jpg|jpeg|png)$'
  );