/*
  # Add automatic invitation acceptance

  1. Changes
    - Add trigger to automatically link invitations to new users
    - Ensures users get access to forms they're invited to upon signup
    - No manual acceptance required if email matches invitation

  2. Logic
    - When a user registers, find any pending invitations for their email
    - Update those invitations with the new user_id
    - Mark invitations as accepted
*/

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Look for any pending invitations matching this email
  UPDATE form_collaborators
  SET 
    user_id = NEW.id,
    invitation_accepted = true,
    updated_at = now()
  WHERE 
    invitation_email = NEW.email
    AND (user_id IS NULL OR invitation_accepted = false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_registration(); 