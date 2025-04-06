/*
  # Add Custom Email Configuration Support

  1. New Tables
    - `custom_email_settings`
      - `id` (uuid, primary key)
      - `form_id` (text, references forms)
      - `custom_email` (text, with email validation)
      - `verified` (boolean, default false)
      - `verification_token` (text, for email verification)
      - `verification_sent_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on custom_email_settings table
    - Add policies for authenticated users
*/

-- Create custom email settings table
CREATE TABLE custom_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  custom_email text NOT NULL,
  verified boolean DEFAULT false,
  verification_token text,
  verification_sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_custom_email CHECK (custom_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_email_settings_timestamp
BEFORE UPDATE ON custom_email_settings
FOR EACH ROW
EXECUTE FUNCTION update_custom_email_settings_updated_at();

-- Enable RLS
ALTER TABLE custom_email_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their form custom email settings"
ON custom_email_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = custom_email_settings.form_id
    AND forms.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = custom_email_settings.form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_custom_email_settings_form_id ON custom_email_settings(form_id);

-- Add default sender name column to forms table
ALTER TABLE forms ADD COLUMN default_sender_name text;