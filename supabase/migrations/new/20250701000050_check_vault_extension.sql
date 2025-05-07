-- Check if Vault integration is enabled
DO $$
BEGIN
  -- Check if vault schema exists (current naming)
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'vault'
  ) THEN
    RAISE NOTICE 'Vault schema is available - integration appears to be enabled.';
  -- Or check if supabase_vault schema exists (alternate naming)
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'supabase_vault'
  ) THEN
    RAISE NOTICE 'Supabase_vault schema is available - integration appears to be enabled.';
  ELSE
    RAISE WARNING 'Vault integration does not appear to be enabled. Please enable it in the Supabase dashboard under "Installed Integrations".';
  END IF;
  
  -- Also check for the functions
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'create_secret'
    AND n.nspname IN ('vault', 'supabase_vault')
  ) THEN
    RAISE NOTICE 'create_secret function is available.';
  ELSE
    RAISE WARNING 'create_secret function is not available in vault or supabase_vault schema.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_secret'
    AND n.nspname IN ('vault', 'supabase_vault')
  ) THEN
    RAISE NOTICE 'get_secret function is available.';
  ELSE
    RAISE WARNING 'get_secret function is not available in vault or supabase_vault schema.';
  END IF;
END
$$; 