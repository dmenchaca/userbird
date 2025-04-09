/*
  # Fix ambiguous ID reference by renaming return column

  This migration:
  1. Renames the returned 'id' column to 'profile_user_id' in the function signature and SELECT statement.
*/

-- Drop and recreate the function with renamed ID column
CREATE OR REPLACE FUNCTION get_user_profile_by_id(user_id_param UUID)
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
    u.id AS profile_user_id, -- Alias the selected id to match the return table definition
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