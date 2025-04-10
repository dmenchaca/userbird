/*
  # Fix invitation email case sensitivity and add auto-update for existing users

  1. Changes
    - Improve the handle_new_user_registration function to be case-insensitive when comparing emails
    - Add a one-time update to link existing users with unlinked invitations
    - Ensure more reliable invitation acceptance for new users

  2. Logic
    - When a user registers, find any pending invitations matching their email (case-insensitive)
    - Update those invitations with the new user_id
    - Mark invitations as accepted
    - Provide a one-time fix for existing users
*/

-- Drop the existing function and recreate with case-insensitive email matching
DROP FUNCTION IF EXISTS handle_new_user_registration();

CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Look for any pending invitations matching this email (case-insensitive)
  UPDATE form_collaborators
  SET 
    user_id = NEW.id,
    invitation_accepted = true,
    updated_at = now()
  WHERE 
    LOWER(invitation_email) = LOWER(NEW.email)
    AND (user_id IS NULL OR invitation_accepted = false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_registration();

-- One-time fix: update existing users who aren't properly linked to their invitations
DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all users
  FOR user_record IN SELECT id, email FROM auth.users
  LOOP
    -- Update any pending invitations with matching emails
    UPDATE form_collaborators
    SET 
      user_id = user_record.id,
      invitation_accepted = true,
      updated_at = now()
    WHERE 
      LOWER(invitation_email) = LOWER(user_record.email)
      AND (user_id IS NULL OR invitation_accepted = false);
  END LOOP;
END;
$$; 