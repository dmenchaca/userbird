-- Function to ensure only one document has is_current = true per form
CREATE OR REPLACE FUNCTION maintain_single_current_document()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the new/updated record has is_current = true
  IF NEW.is_current = true THEN
    -- Set is_current = false for all other documents with the same form_id
    -- Exclude the current document being inserted/updated (using its ID)
    UPDATE documents
    SET is_current = false
    WHERE 
      form_id = NEW.form_id AND 
      id != NEW.id AND
      is_current = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that runs before insert or update on the documents table
DROP TRIGGER IF EXISTS ensure_single_current_document ON documents;
CREATE TRIGGER ensure_single_current_document
BEFORE INSERT OR UPDATE OF is_current
ON documents
FOR EACH ROW
EXECUTE FUNCTION maintain_single_current_document();

-- Add a comment explaining the trigger's purpose
COMMENT ON TRIGGER ensure_single_current_document ON documents IS 
  'Ensures that only one document can have is_current = true for each form_id'; 