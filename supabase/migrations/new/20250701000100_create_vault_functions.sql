-- Create functions for storing and retrieving secrets from Vault

-- Function to store a secret in Vault
CREATE OR REPLACE FUNCTION create_secret(secret_name TEXT, secret_value TEXT)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_secret_id UUID;
BEGIN
  -- Insert secret into vault and return the ID
  -- The vault.create_secret function takes parameters as (value, name) not (name, value)
  SELECT vault.create_secret(secret_value, secret_name) INTO new_secret_id;
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
  secret_value TEXT;
BEGIN
  -- Get secret from vault by ID
  SELECT vault.get_secret(secret_id) INTO secret_value;
  RETURN secret_value;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error retrieving secret from vault: %', SQLERRM;
END;
$$;

-- Set appropriate privileges
GRANT EXECUTE ON FUNCTION create_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_secret(UUID) TO service_role; 