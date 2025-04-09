/*
  # Add notification settings table

  1. New Tables
    - `notification_settings`
      - `id` (uuid, primary key)
      - `form_id` (text, foreign key to forms)
      - `email` (text, with email validation)
      - `enabled` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policy for authenticated users to manage their form notifications
*/

-- Create notification settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  email text NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies conditionally
DO $$
BEGIN
  -- Check if policy already exists
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'notification_settings'
    AND policyname = 'Users can manage their form notification settings'
  ) THEN
    -- Create policy
    CREATE POLICY "Users can manage their form notification settings"
    ON notification_settings
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM forms
        WHERE forms.id = notification_settings.form_id
        AND forms.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM forms
        WHERE forms.id = notification_settings.form_id
        AND forms.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Create index conditionally
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'notification_settings'
    AND indexname = 'idx_notification_settings_form_id'
  ) THEN
    -- Create index for faster lookups
    CREATE INDEX idx_notification_settings_form_id ON notification_settings(form_id);
  END IF;
END $$;