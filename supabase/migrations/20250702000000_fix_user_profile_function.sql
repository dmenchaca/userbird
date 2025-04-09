/*
  # Fix get_user_profile function

  This migration:
  1. Improves the user profile function to better handle null values
  2. Adds debugging info to help troubleshoot the issue
  3. Makes sure we're correctly accessing raw_user_meta_data
*/

-- Drop and recreate the function with better null handling
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
DECLARE
  meta_data JSONB;
BEGIN
  -- First, let's log the user_id we're looking for
  RAISE LOG 'get_user_profile_by_id called with user_id: %', user_id_param;
  
  -- Get the user's metadata
  SELECT 
    raw_user_meta_data INTO meta_data
  FROM 
    auth.users 
  WHERE 
    id = user_id_param;
  
  -- Log the metadata we found
  RAISE LOG 'User metadata: %', meta_data;
  
  -- Return the query results with better null handling
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
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