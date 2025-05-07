-- Find closest matching functions to what we need for Vault
DO $$
DECLARE
  func_record RECORD;
BEGIN
  RAISE NOTICE '--- Searching for create_secret function or similar ---';
  FOR func_record IN 
    SELECT 
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS argument_list,
      pg_get_function_result(p.oid) AS return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE 
      (p.proname = 'create_secret' OR
       p.proname LIKE '%create%secret%' OR
       p.proname LIKE '%store%secret%' OR
       p.proname LIKE '%add%secret%' OR
       p.proname LIKE '%insert%secret%' OR
       p.proname LIKE '%encrypt%')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 
      CASE WHEN p.proname = 'create_secret' THEN 0 ELSE 1 END,
      n.nspname,
      p.proname
  LOOP
    RAISE NOTICE 'Potential create function: %.%(%) -> %', 
      func_record.schema_name, 
      func_record.function_name,
      func_record.argument_list,
      func_record.return_type;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '--- Searching for get_secret function or similar ---';
  FOR func_record IN 
    SELECT 
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_arguments(p.oid) AS argument_list,
      pg_get_function_result(p.oid) AS return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE 
      (p.proname = 'get_secret' OR
       p.proname LIKE '%get%secret%' OR
       p.proname LIKE '%read%secret%' OR
       p.proname LIKE '%fetch%secret%' OR
       p.proname LIKE '%retrieve%secret%' OR
       p.proname LIKE '%decrypt%')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY 
      CASE WHEN p.proname = 'get_secret' THEN 0 ELSE 1 END,
      n.nspname,
      p.proname
  LOOP
    RAISE NOTICE 'Potential get function: %.%(%) -> %', 
      func_record.schema_name, 
      func_record.function_name,
      func_record.argument_list,
      func_record.return_type;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '--- Checking for vault, secrets or pgsodium tables ---';
  FOR func_record IN 
    SELECT 
      table_schema,
      table_name
    FROM information_schema.tables
    WHERE 
      (table_name LIKE '%secret%' OR table_schema LIKE '%vault%')
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name
  LOOP
    RAISE NOTICE 'Relevant table: %.%', 
      func_record.table_schema, 
      func_record.table_name;
  END LOOP;
END
$$; 