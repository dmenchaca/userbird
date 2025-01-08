/*
  # Fix notification settings

  1. Changes
    - Ensure notification_settings table exists
    - Drop and recreate trigger to handle edge cases
    - Re-run backfill with proper error handling
*/

-- Ensure notification_settings table exists
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

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their form notification settings" ON notification_settings;

-- Create new policy
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

-- Drop and recreate trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_form()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert notification setting for the owner if table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'notification_settings'
    ) THEN
        INSERT INTO notification_settings (form_id, email)
        SELECT NEW.id, email
        FROM auth.users
        WHERE id = NEW.owner_id
        AND email IS NOT NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_form_created ON forms;
CREATE TRIGGER on_form_created
    AFTER INSERT ON forms
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_form();

-- Re-run backfill with proper error handling
DO $$
BEGIN
    -- Only run if table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'notification_settings'
    ) THEN
        INSERT INTO notification_settings (form_id, email)
        SELECT f.id, u.email
        FROM forms f
        JOIN auth.users u ON f.owner_id = u.id
        WHERE NOT EXISTS (
            SELECT 1 
            FROM notification_settings ns 
            WHERE ns.form_id = f.id 
            AND ns.email = u.email
        )
        AND u.email IS NOT NULL;
    END IF;
END $$;