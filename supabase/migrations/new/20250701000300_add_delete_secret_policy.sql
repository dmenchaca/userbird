-- Add policy to allow authenticated users to delete secrets they own
-- This assumes that users can only delete secrets associated with their own forms

-- Grant execute permission on the delete_secret function
GRANT EXECUTE ON FUNCTION delete_secret TO authenticated;

-- Create a view to track secret ownership
CREATE OR REPLACE VIEW user_owned_slack_secrets AS
SELECT 
  i.bot_token_id as secret_id,
  f.owner_id as user_id
FROM 
  slack_integrations i
JOIN 
  forms f ON i.form_id = f.id
WHERE 
  i.bot_token_id IS NOT NULL;

COMMENT ON VIEW user_owned_slack_secrets IS 'View that links vault secrets to their owners through form->integration relationships';

-- Add schema-level security policy for the delete_secret function
CREATE OR REPLACE FUNCTION check_secret_ownership(secret_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  is_owned BOOLEAN;
BEGIN
  -- Check if the secret belongs to the current user
  SELECT EXISTS (
    SELECT 1 
    FROM user_owned_slack_secrets
    WHERE secret_id = check_secret_ownership.secret_id
    AND user_id = auth.uid()
  ) INTO is_owned;
  
  -- Also allow service role to delete any secret
  RETURN is_owned OR (SELECT nullif(current_setting('role', true), '') = 'service_role');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 