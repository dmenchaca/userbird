/*
  # Update get_user_profile function to use Display Name

  This migration:
  1. Updates the function to prioritize 'full_name' and 'name' from metadata for the username field.
  2. Falls back to email if display name fields are not found.
*/

-- Drop and recreate the function to fetch display name
CREATE OR REPLACE FUNCTION get_user_profile_by_id(user_id_param UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  username TEXT, -- This column will now hold the Display Name
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return the query results
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    -- Prioritize full_name, then name, then email for the display name
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.email -- Fallback to email
    ) AS username,
    -- Keep avatar logic the same
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