/*
  # Add auth helper functions

  1. New Functions:
    - `get_user_id_by_email` - Gets the user ID from auth.users given an email address
      - Requires service role privileges
*/

-- Enable the pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create function to get user ID by email (requires service role to access auth.users)
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_param TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Query from auth.users directly
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = email_param
  LIMIT 1;
  
  RETURN user_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_user_id_by_email TO authenticated; 