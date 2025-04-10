/*
  # Fix case sensitivity in get_user_id_by_email function

  1. Changes
    - Update the get_user_id_by_email function to be case-insensitive when comparing emails
    - Ensures consistency with handle_new_user_registration function and collaborator invites
*/

-- Update function to get user ID by email with case-insensitive matching
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_param TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Query from auth.users with case-insensitive comparison
  SELECT id INTO user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(email_param)
  LIMIT 1;
  
  RETURN user_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO authenticated; 