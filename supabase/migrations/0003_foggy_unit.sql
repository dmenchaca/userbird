/*
  # Fix URL validation for local development

  1. Changes
    - Update URL validation function to allow localhost URLs
    - Add support for ports in URLs
  
  2. Security
    - Maintains existing security while allowing local development
*/

-- Update URL validation function to support localhost and ports
CREATE OR REPLACE FUNCTION is_valid_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Allow localhost with optional port
  IF url ~ '^localhost(:[0-9]+)?$' THEN
    RETURN true;
  END IF;
  
  -- Allow standard domains with optional port
  RETURN url ~ '^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](\.[a-zA-Z]{2,})(:[0-9]+)?$';
END;
$$ LANGUAGE plpgsql;