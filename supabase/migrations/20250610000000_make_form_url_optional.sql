/*
  # Make form URL optional

  1. Changes
    - Alter the forms table to make the URL field nullable
    - This supports the workspace setup flow where users first name their workspace before setting a specific URL

  2. Background
    - In the original schema, URL was a required field (NOT NULL)
    - The onboarding wizard now focuses on workspace creation with a product name first
    - URL can be configured later via form settings
*/

-- Modify the forms table to make URL optional
ALTER TABLE forms ALTER COLUMN url DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN forms.url IS 'The form URL (optional during initial workspace setup, can be configured later)'; 