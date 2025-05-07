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
  -- Check if vault extension is available
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vault'
  ) THEN
    RAISE EXCEPTION 'Vault extension is not enabled. Please enable it via Supabase dashboard.';
  END IF;

  -- Insert secret into vault and return the ID
  -- Vault function may be vault.create_secret or pgvault.create_secret depending on version
  BEGIN
    -- Try vault schema first (newer versions)
    SELECT vault.create_secret(secret_value, secret_name) INTO new_secret_id;
  EXCEPTION WHEN undefined_function THEN
    -- Fall back to pgvault schema (older versions)
    SELECT pgvault.create_secret(secret_value, secret_name) INTO new_secret_id;
  END;
  
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
  -- Check if vault extension is available
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vault'
  ) THEN
    RAISE EXCEPTION 'Vault extension is not enabled. Please enable it via Supabase dashboard.';
  END IF;
  
  -- Retrieve secret from vault
  -- Vault function may be vault.get_secret or pgvault.get_secret depending on version
  BEGIN
    -- Try vault schema first (newer versions)
    SELECT vault.get_secret(secret_id) INTO secret_value;
  EXCEPTION WHEN undefined_function THEN
    -- Fall back to pgvault schema (older versions)
    SELECT pgvault.get_secret(secret_id) INTO secret_value;
  END;
  
  RETURN secret_value;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error retrieving secret from vault: %', SQLERRM;
END;
$$;

-- Set appropriate privileges
GRANT EXECUTE ON FUNCTION create_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_secret(UUID) TO service_role; 