/*
  # Add email notification support
  
  1. New Tables
    - notification_settings
      - id (uuid, primary key)
      - form_id (text, references forms)
      - email (text)
      - enabled (boolean)
      - created_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policy for form owners
*/

-- Check if notification_settings table already exists
DO $$
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'notification_settings'
  ) THEN
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

    -- Create index for faster lookups
    CREATE INDEX idx_notification_settings_form_id ON notification_settings(form_id);
  ELSE
    RAISE NOTICE 'notification_settings table already exists, skipping creation.';
  END IF;
END
$$;

-- Create policies conditionally
DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'notification_settings'
  ) AND NOT EXISTS (
    SELECT FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'notification_settings'
    AND policyname = 'Users can manage their form notification settings'
  ) THEN
    -- Create policies
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
END
$$;