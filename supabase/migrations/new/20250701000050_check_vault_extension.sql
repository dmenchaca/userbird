-- Check if Vault extension is installed and enable it if not
DO $$
BEGIN
  -- Check if Vault extension exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vault'
  ) THEN
    -- Output message
    RAISE NOTICE 'Vault extension is not installed. Please enable it via Supabase dashboard.';
    
    -- Try to create the extension (this will work if user has proper privileges)
    BEGIN
      CREATE EXTENSION IF NOT EXISTS vault;
      RAISE NOTICE 'Vault extension has been enabled successfully.';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not automatically enable Vault extension: %. Please enable it manually.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Vault extension is already installed.';
  END IF;
END
$$; 