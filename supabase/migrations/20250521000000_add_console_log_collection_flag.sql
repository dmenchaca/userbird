/*
  # Add console log collection flag to forms

  1. Changes
    - Add collect_console_logs column to forms table
    - Default value is true to maintain backward compatibility
    
  2. Notes
    - This flag controls whether the widget.js collects console logs automatically
    - Setting to false will disable console log collection for that specific form
    - Existing forms will continue to collect console logs by default
*/

-- Add collect_console_logs column to forms table with default value true
ALTER TABLE forms
ADD COLUMN IF NOT EXISTS collect_console_logs boolean DEFAULT true;

-- Add comment to the column for documentation
COMMENT ON COLUMN forms.collect_console_logs IS 'Controls whether widget.js automatically collects console logs. Default is true for backward compatibility.';
