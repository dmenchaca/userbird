/*
  # Add automatic notification settings for form owners

  1. Changes
    - Add trigger to automatically create notification settings for form owners
    - Insert notification settings for existing forms

  2. Details
    - Creates a trigger function to handle new form creation
    - Automatically adds form owner's email to notification settings
    - Backfills existing forms with notification settings
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_new_form()
RETURNS TRIGGER AS $$
DECLARE
    owner_email text;
BEGIN
    -- Get the owner's email from auth.users
    SELECT email INTO owner_email
    FROM auth.users
    WHERE id = NEW.owner_id;

    -- Insert notification setting for the owner
    IF owner_email IS NOT NULL THEN
        INSERT INTO notification_settings (form_id, email)
        VALUES (NEW.id, owner_email);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_form_created ON forms;
CREATE TRIGGER on_form_created
    AFTER INSERT ON forms
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_form();

-- Backfill notification settings for existing forms
INSERT INTO notification_settings (form_id, email)
SELECT f.id, u.email
FROM forms f
JOIN auth.users u ON f.owner_id = u.id
WHERE NOT EXISTS (
    SELECT 1 
    FROM notification_settings ns 
    WHERE ns.form_id = f.id 
    AND ns.email = u.email
);