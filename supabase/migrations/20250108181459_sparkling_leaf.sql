/*
  # Add Email Notifications Support

  1. New Tables
    - `notification_settings`
      - `id` (uuid, primary key)
      - `form_id` (text, references forms)
      - `email` (text)
      - `enabled` (boolean)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on notification_settings table
    - Add policies for authenticated users
*/

-- Create notification settings table
CREATE TABLE notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  email text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their form notification settings"
ON notification_settings
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = notification_settings.form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_notification_settings_form_id ON notification_settings(form_id);