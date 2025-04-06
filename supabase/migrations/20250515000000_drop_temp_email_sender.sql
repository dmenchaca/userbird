/*
  # Drop Temporary Email Sender Table
  
  This table is no longer needed since we're using a different approach
  with the monkey-patching approach in our Netlify functions.
*/

-- Drop the cleanup trigger
DROP TRIGGER IF EXISTS cleanup_temp_email_sender_trigger ON temp_email_sender;

-- Drop the cleanup function
DROP FUNCTION IF EXISTS cleanup_temp_email_sender();

-- Drop the policy
DROP POLICY IF EXISTS "Service functions can manage temp_email_sender" ON temp_email_sender;

-- Drop the table
DROP TABLE IF EXISTS temp_email_sender; 