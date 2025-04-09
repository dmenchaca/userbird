/*
  # Add collaboration helper functions

  1. New Functions:
    - `get_user_collaboration_forms` - Gets the form IDs a user is a collaborator on
      - Avoids RLS recursion by using security definer
*/

-- Function to get forms where a user is a collaborator
CREATE OR REPLACE FUNCTION get_user_collaboration_forms(user_id_param UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  form_ids TEXT[];
BEGIN
  -- Query the form_collaborators table directly, bypassing RLS
  SELECT COALESCE(ARRAY_AGG(form_id), ARRAY[]::TEXT[])
  INTO form_ids
  FROM form_collaborators
  WHERE user_id = user_id_param
    AND invitation_accepted = true;
  
  -- For debugging
  RAISE LOG 'get_user_collaboration_forms called with user_id: % returning forms: %', user_id_param, form_ids;
  
  RETURN form_ids;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_collaboration_forms TO authenticated; 