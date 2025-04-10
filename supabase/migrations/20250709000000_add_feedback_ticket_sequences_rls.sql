/*
  # Add RLS policy for feedback_ticket_sequences table
  
  This migration adds a restrictive RLS policy for the feedback_ticket_sequences table
  to ensure data integrity while allowing the necessary operations for ticket number generation.
  
  1. Changes:
    - Ensure RLS is enabled on the table
    - Add policies for read-only access based on form_collaborators table
    - Make the generate_ticket_number function SECURITY DEFINER to bypass RLS
    - Only service_role can directly manage sequences for administrative purposes
*/

-- Make sure RLS is enabled
ALTER TABLE feedback_ticket_sequences ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view sequences based on form_collaborators
CREATE POLICY "Admin collaborators can view sequences"
  ON feedback_ticket_sequences
  FOR SELECT
  TO authenticated
  USING (
    form_id IN (
      SELECT form_id FROM form_collaborators 
      WHERE form_id = feedback_ticket_sequences.form_id 
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create policy for agents to view sequences for their assigned forms
CREATE POLICY "Agent collaborators can view sequences"
  ON feedback_ticket_sequences
  FOR SELECT
  TO authenticated
  USING (
    form_id IN (
      SELECT form_id FROM form_collaborators 
      WHERE form_id = feedback_ticket_sequences.form_id 
      AND user_id = auth.uid()
      AND role = 'agent'
    )
  );

-- Create policy for service role (admin access) - only for emergencies and database maintenance
CREATE POLICY "Service role can manage all sequences"
  ON feedback_ticket_sequences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop the existing trigger first to avoid dependency issues
DROP TRIGGER IF EXISTS set_ticket_number ON feedback;

-- Then drop and recreate the generate_ticket_number function with SECURITY DEFINER
DROP FUNCTION IF EXISTS generate_ticket_number();

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
$$ LANGUAGE plpgsql
SECURITY DEFINER; -- This allows the function to bypass RLS

-- Re-create the trigger
CREATE TRIGGER set_ticket_number
BEFORE INSERT ON feedback
FOR EACH ROW
EXECUTE FUNCTION generate_ticket_number();

-- Grant appropriate permissions - but only SELECT to authenticated users
GRANT ALL ON TABLE feedback_ticket_sequences TO postgres;
GRANT SELECT ON TABLE feedback_ticket_sequences TO authenticated;
GRANT EXECUTE ON FUNCTION generate_ticket_number() TO authenticated; 