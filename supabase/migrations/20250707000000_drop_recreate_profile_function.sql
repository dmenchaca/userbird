/*
  # Fix function return type by dropping and recreating

  This migration:
  1. Drops the existing get_user_profile_by_id function.
  2. Recreates the function with the correct return signature (profile_user_id UUID).
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_user_profile_by_id(UUID);

-- Create the function with the correct return signature
CREATE FUNCTION get_user_profile_by_id(user_id_param UUID)
RETURNS TABLE (
  profile_user_id UUID, -- Renamed from id
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
    u.id AS profile_user_id,
    u.email::TEXT,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.email::TEXT
    )::TEXT AS username,
    COALESCE(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'avatarUrl',
      u.raw_user_meta_data->>'picture'
    )::TEXT AS avatar_url
  FROM 
    auth.users u
  WHERE 
    u.id = user_id_param;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profile_by_id TO authenticated; 