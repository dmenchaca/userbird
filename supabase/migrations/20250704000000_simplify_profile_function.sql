/*
  # Simplify get_user_profile function

  This migration:
  1. Simplifies the SELECT statement in the function
  2. Removes potentially problematic column aliases for direct fields
*/

-- Drop and recreate the function with simpler SELECT
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
  -- Return the query results
  RETURN QUERY
  SELECT 
    u.id, -- Removed 'AS id'
    u.email, -- Removed 'AS email'
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'username',
      u.email
    ) AS username,
    COALESCE(
      u.raw_user_meta_data->>'avatar_url',
      u.raw_user_meta_data->>'avatarUrl',
      u.raw_user_meta_data->>'picture'
    ) AS avatar_url
  FROM 
    auth.users u
  WHERE 
    u.id = user_id_param;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profile_by_id TO authenticated; 