/*
  # Add Debugging Functions

  1. New Functions
    - debug_table_schema: Returns the schema info for a given table including constraints
*/

-- Create debugging function to check table schema
CREATE OR REPLACE FUNCTION debug_table_schema(table_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get table columns and constraints
  WITH columns AS (
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM 
      information_schema.columns
    WHERE 
      table_name = debug_table_schema.table_name
      AND table_schema = 'public'
  ),
  constraints AS (
    SELECT 
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name
    FROM 
      information_schema.table_constraints tc
    JOIN 
      information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE 
      tc.table_name = debug_table_schema.table_name
      AND tc.table_schema = 'public'
  )
  SELECT 
    jsonb_build_object(
      'columns', jsonb_agg(
        jsonb_build_object(
          'name', c.column_name,
          'type', c.data_type,
          'nullable', c.is_nullable,
          'default', c.column_default
        )
      ),
      'constraints', (
        SELECT 
          jsonb_agg(
            jsonb_build_object(
              'name', cs.constraint_name,
              'type', cs.constraint_type,
              'column', cs.column_name
            )
          )
        FROM 
          constraints cs
      )
    ) INTO result
  FROM 
    columns c;
    
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_table_schema TO authenticated; 