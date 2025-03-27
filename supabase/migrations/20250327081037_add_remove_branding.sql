-- Add remove_branding column to forms table with default value false
ALTER TABLE forms ADD COLUMN remove_branding boolean DEFAULT false;

-- Add comment to the column for documentation
COMMENT ON COLUMN forms.remove_branding IS 'Controls whether to show "We run on Userbird" branding in the widget'; 