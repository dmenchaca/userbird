-- Discover Vault-related schemas and functions
DO $$
DECLARE
  schema_record RECORD;
  func_record RECORD;
BEGIN
  RAISE NOTICE 'Discovering Vault-related schemas and functions:';
  
  -- List all schemas
  RAISE NOTICE 'Available schemas that might be related to Vault:';
  FOR schema_record IN 
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name LIKE '%vault%' OR schema_name = 'pgsodium'
  LOOP
    RAISE NOTICE 'Schema: %', schema_record.schema_name;
  END LOOP;
  
  -- List all functions with "secret" in the name
  RAISE NOTICE 'Functions that might be related to Vault:';
  FOR func_record IN 
    SELECT 
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS argument_list
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE 
      p.proname LIKE '%secret%' OR 
      p.proname LIKE '%vault%' OR 
      p.proname LIKE '%encrypt%' OR
      p.proname LIKE '%decrypt%'
  LOOP
    RAISE NOTICE 'Function: %.%(%) - This might be what we need!', 
      func_record.schema_name, 
      func_record.function_name,
      func_record.argument_list;
  END LOOP;
  
  -- Also check for tables related to vault
  RAISE NOTICE 'Tables that might be related to Vault:';
  FOR func_record IN 
    SELECT 
      table_schema,
      table_name
    FROM information_schema.tables
    WHERE 
      table_name LIKE '%secret%' OR 
      table_name LIKE '%vault%' OR
      table_schema LIKE '%vault%' OR
      table_schema = 'pgsodium'
  LOOP
    RAISE NOTICE 'Table: %.%', 
      func_record.table_schema, 
      func_record.table_name;
  END LOOP;
END
$$; 