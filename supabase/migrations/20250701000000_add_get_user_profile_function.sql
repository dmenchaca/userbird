/*
  # Add get_user_profile function

  This migration:
  1. Creates a new function to get user profile data from auth.users table
  2. Returns email, avatar_url and full_name from user_metadata
  3. Uses SECURITY DEFINER to bypass RLS restrictions
*/

-- Create function to get user profile by ID
CREATE OR REPLACE FUNCTION get_user_profile_by_id(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name' AS username,
    u.raw_user_meta_data->>'avatar_url' AS avatar_url
  FROM 
    auth.users u
  WHERE 
    u.id = user_id_param;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profile_by_id TO authenticated; 