/*
  # Add screenshot method flag to forms

  1. Changes
    - Add screenshot_method column to forms table
    - Default value is 'canvas' to maintain backward compatibility with existing native canvas capture
    - Allowed values: 'canvas' for native capture, 'browser' for browser API
    
  2. Notes
    - This flag controls the screenshot capture method for feedback submissions
    - 'canvas' uses the existing html2canvas implementation
    - 'browser' uses the native browser Screen Capture API with user authorization
    - Existing forms will continue to use canvas method by default
*/

BEGIN;

-- Add screenshot_method column to forms table with default value 'canvas'
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS screenshot_method text DEFAULT 'canvas' CHECK (screenshot_method IN ('canvas', 'browser'));

-- Add comment to the column for documentation
COMMENT ON COLUMN forms.screenshot_method IS 'Controls the screenshot capture method: canvas (html2canvas) or browser (Screen Capture API). Default is canvas for backward compatibility.';

-- Update Studio permissions
GRANT ALL ON forms TO authenticated;
GRANT SELECT ON forms TO anon;

COMMIT; 
