-- Create user_has_form_access function that checks table existence
CREATE OR REPLACE FUNCTION user_has_form_access(form_id_param TEXT, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists BOOLEAN;
BEGIN
  -- Check if form_collaborators table exists
  SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'form_collaborators'
  ) INTO table_exists;

  -- If collaborators table exists, check both owner access and collaborator access
  IF table_exists THEN
    RETURN (
      EXISTS (SELECT 1 FROM forms WHERE id = form_id_param AND owner_id = user_id_param)
      OR 
      EXISTS (
        SELECT 1 FROM form_collaborators 
        WHERE form_id = form_id_param 
        AND user_id = user_id_param
        AND invitation_accepted = true
      )
    );
  ELSE
    -- If collaborators table doesn't exist, just check owner access
    RETURN EXISTS (SELECT 1 FROM forms WHERE id = form_id_param AND owner_id = user_id_param);
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_has_form_access TO authenticated; 