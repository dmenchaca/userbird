-- Create function for deleting secrets from Vault
CREATE OR REPLACE FUNCTION delete_secret(secret_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  success BOOLEAN;
BEGIN
  -- Delete secret from vault by ID
  SELECT vault.delete_secret(secret_id) INTO success;
  
  -- Return success status
  RETURN success;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error deleting secret from vault: %', SQLERRM;
    RETURN FALSE;
END;
$$;

-- Add comment to the function
COMMENT ON FUNCTION delete_secret IS 'Deletes a secret from the Supabase Vault by its ID.'; 