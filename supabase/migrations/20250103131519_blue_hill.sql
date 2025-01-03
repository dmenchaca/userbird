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