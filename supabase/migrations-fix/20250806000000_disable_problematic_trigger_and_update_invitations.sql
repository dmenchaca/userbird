/*
  # Disable problematic trigger and provide cleanup function

  This migration:
  1. Disables the trigger that's causing account creation failures
  2. Creates a one-time function to update unlinked invitations
  3. We'll replace the functionality with a Netlify function
*/

-- Drop the trigger that's causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Keep the function for later manual use if needed, but not triggered automatically
CREATE OR REPLACE FUNCTION update_unlinked_invitations()
RETURNS TABLE (
  email TEXT,
  invitations_updated INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  updated_count INTEGER := 0;
  email_result TEXT;
BEGIN
  -- Loop through all users
  FOR user_record IN SELECT id, email FROM auth.users
  LOOP
    -- Update invitations matching this user's email
    UPDATE form_collaborators
    SET 
      user_id = user_record.id,
      invitation_accepted = true,
      updated_at = now()
    WHERE 
      LOWER(invitation_email) = LOWER(user_record.email)
      AND user_id IS NULL;
      
    -- If we updated any records for this user, add to results
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
      email_result := user_record.email;
      RETURN QUERY SELECT email_result, updated_count;
    END IF;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION update_unlinked_invitations TO authenticated; 