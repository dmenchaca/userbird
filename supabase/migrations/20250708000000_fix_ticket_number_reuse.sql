/*
  # Fix ticket number reuse issue

  1. Changes
    - Create a feedback_ticket_sequences table to track the last used number for each form
    - Modify generate_ticket_number() function to use this table instead of MAX approach
    - Initialize sequences table with current highest values
    
  This ensures ticket numbers are never reused, even when feedback entries are deleted.
*/

-- Create a table to track ticket sequences per form
CREATE TABLE IF NOT EXISTS feedback_ticket_sequences (
  form_id text PRIMARY KEY,
  last_number integer NOT NULL
);

-- Drop existing trigger temporarily
DROP TRIGGER IF EXISTS set_ticket_number ON feedback;

-- Modify function to use the sequences table
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number integer;
BEGIN
  -- Lock the sequences row for this form to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('feedback_ticket_' || NEW.form_id));
  
  -- Check if a sequence exists for this form
  IF EXISTS (SELECT 1 FROM feedback_ticket_sequences WHERE form_id = NEW.form_id) THEN
    -- Get the next number and update the sequence
    UPDATE feedback_ticket_sequences
    SET last_number = last_number + 1
    WHERE form_id = NEW.form_id
    RETURNING last_number INTO next_number;
  ELSE
    -- Initialize a new sequence
    -- Start with MAX + 1 or 1 if no existing entries
    SELECT COALESCE(MAX(ticket_number) + 1, 1)
    INTO next_number
    FROM feedback
    WHERE form_id = NEW.form_id;
    
    -- Insert the new sequence
    INSERT INTO feedback_ticket_sequences (form_id, last_number)
    VALUES (NEW.form_id, next_number);
  END IF;
  
  -- Assign the ticket number
  NEW.ticket_number = next_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Initialize the sequences table with current highest values per form
INSERT INTO feedback_ticket_sequences (form_id, last_number)
SELECT form_id, COALESCE(MAX(ticket_number), 0)
FROM feedback
GROUP BY form_id
ON CONFLICT (form_id) 
DO NOTHING;

-- Re-create the trigger
CREATE TRIGGER set_ticket_number
BEFORE INSERT ON feedback
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number();

-- Grant appropriate permissions
GRANT ALL ON TABLE feedback_ticket_sequences TO postgres;
GRANT SELECT, INSERT, UPDATE ON TABLE feedback_ticket_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION generate_ticket_number() TO authenticated; 