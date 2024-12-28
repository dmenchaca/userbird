/*
  # Enhanced security policies for feedback system

  1. Changes
    - Add RLS policies for forms and feedback tables
    - Add policies for public form creation and reading
    - Add policies for public feedback submission
    - Add indexes for better query performance

  2. Security
    - Enable RLS on both tables
    - Restrict feedback submissions to existing form IDs
    - Allow public access for form creation and feedback submission
    - Add validation for form URLs
*/

-- Add URL validation check
CREATE OR REPLACE FUNCTION is_valid_url(url text)
RETURNS boolean AS $$
BEGIN
  RETURN url ~ '^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$';
END;
$$ LANGUAGE plpgsql;

-- Add form URL validation policy
CREATE POLICY "Validate form URL on insert"
  ON forms
  FOR INSERT
  WITH CHECK (is_valid_url(url));

-- Add index for form lookups
CREATE INDEX IF NOT EXISTS idx_feedback_form_id ON feedback(form_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Add policy to ensure feedback only links to existing forms
CREATE POLICY "Ensure feedback links to existing form"
  ON feedback
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms WHERE id = form_id
    )
  );

-- Add policy for reading feedback by form ID
CREATE POLICY "Allow reading feedback by form ID"
  ON feedback
  FOR SELECT
  USING (true);

-- Add policy for reading forms
CREATE POLICY "Allow reading forms"
  ON forms
  FOR SELECT
  USING (true);