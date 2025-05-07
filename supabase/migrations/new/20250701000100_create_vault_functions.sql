-- Create functions for storing and retrieving secrets from Vault

-- Drop existing functions first
DROP FUNCTION IF EXISTS create_secret(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_secret(UUID);

-- Function to store a secret in Vault
CREATE OR REPLACE FUNCTION create_secret(secret_value TEXT, secret_name TEXT DEFAULT NULL)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_secret_id UUID;
BEGIN
  -- According to Supabase documentation, vault.create_secret() takes:
  -- 1. secret_value as first parameter (required)
  -- 2. unique_name as second parameter (optional)
  -- 3. description as third parameter (optional)
  
  -- Store the secret using the documented API
  IF secret_name IS NULL THEN
    -- Just the secret value
    SELECT vault.create_secret(secret_value) INTO new_secret_id;
  ELSE
    -- Secret value with name
    SELECT vault.create_secret(secret_value, secret_name) INTO new_secret_id;
  END IF;
  
  RETURN new_secret_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error storing secret in vault: %', SQLERRM;
END;
$$;

-- Function to retrieve a secret from Vault
CREATE OR REPLACE FUNCTION get_secret(secret_id UUID)
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  decrypted_secret_value TEXT;
BEGIN
  -- According to Supabase documentation, there's no get_secret function
  -- Instead, we query the vault.decrypted_secrets view
  SELECT decrypted_secret INTO decrypted_secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  
  IF decrypted_secret_value IS NULL THEN
    RAISE EXCEPTION 'Secret not found with ID: %', secret_id;
  END IF;
  
  RETURN decrypted_secret_value;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error retrieving secret from vault: %', SQLERRM;
END;
$$;

-- Set appropriate privileges
GRANT EXECUTE ON FUNCTION create_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_secret(UUID) TO service_role; 