/*
  # Add ticket numbers to feedback entries

  1. Changes
    - Add `ticket_number` column to the `feedback` table
    - Create function to generate sequential ticket numbers per form
    - Add trigger to automatically assign ticket numbers on insert
    
  This allows tracking feedback with unique, auto-incremental ticket numbers
  specific to each form. Ticket numbers start from 1.
*/

-- Add ticket_number column to feedback table
ALTER TABLE feedback 
  ADD COLUMN ticket_number integer;

-- Create index for faster lookups by ticket number
CREATE INDEX IF NOT EXISTS idx_feedback_ticket_number 
  ON feedback(form_id, ticket_number);

-- Function to generate sequential ticket numbers per form
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Get the next ticket number for this form_id
  SELECT COALESCE(MAX(ticket_number) + 1, 1)
  INTO NEW.ticket_number
  FROM feedback
  WHERE form_id = NEW.form_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically assign ticket numbers on insert
CREATE TRIGGER set_ticket_number
BEFORE INSERT ON feedback
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number();

-- Backfill existing feedback entries with ticket numbers
DO $$
DECLARE
  form RECORD;
  ticket_counter INTEGER;
  feedback_row RECORD;
BEGIN
  -- Process each form separately
  FOR form IN SELECT DISTINCT form_id FROM feedback ORDER BY form_id
  LOOP
    ticket_counter := 1;
    
    -- Update each feedback entry for this form with an incremental ticket number
    FOR feedback_row IN 
      SELECT id FROM feedback 
      WHERE form_id = form.form_id 
      ORDER BY created_at ASC
    LOOP
      UPDATE feedback 
      SET ticket_number = ticket_counter 
      WHERE id = feedback_row.id;
      
      ticket_counter := ticket_counter + 1;
    END LOOP;
  END LOOP;
END $$; 