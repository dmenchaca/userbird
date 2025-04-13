/*
  # Assignment Notification Webhook Trigger
  
  This migration adds a database function and trigger to notify a Netlify function
  when a user is assigned to a feedback form (ticket) via a new assignment record
  in the feedback_replies table.
  
  When a new feedback_reply with type='assignment' is created with sender_type='admin',
  it will call the webhook to send an email notification to the assigned user.
*/

-- Create or replace function to handle the webhook notification
CREATE OR REPLACE FUNCTION notify_assignment_webhook()
RETURNS TRIGGER AS $$
DECLARE
  feedback_record RECORD;
  form_record RECORD;
  netlify_function_url TEXT;
  assignee_email TEXT;
  assignee_name TEXT;
  sender_email TEXT;
  sender_name TEXT;
BEGIN
  -- Only fire for new assignment entries from admins
  IF NEW.type = 'assignment' AND NEW.sender_type = 'admin' AND NEW.assigned_to IS NOT NULL THEN
    -- Hard-code the webhook URL since we can't use database parameters due to permissions
    -- In development, this would be changed manually by developers as needed
    netlify_function_url := 'https://app.userbird.co/.netlify/functions/send-notification';
    
    -- Get feedback details
    SELECT * INTO feedback_record FROM feedback WHERE id = NEW.feedback_id;
    
    -- Get form details
    SELECT * INTO form_record FROM forms WHERE id = feedback_record.form_id;
    
    -- Get assignee email
    SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) 
    INTO assignee_email, assignee_name
    FROM auth.users 
    WHERE id = NEW.assigned_to;
    
    -- Get sender info if available
    SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) 
    INTO sender_email, sender_name
    FROM auth.users 
    WHERE id = NEW.sender_id;
    
    IF assignee_email IS NOT NULL THEN
      -- Call the webhook asynchronously
      PERFORM http((
        'POST',                                            -- method
        netlify_function_url,                              -- url
        ARRAY[('Content-Type', 'application/json')],      -- headers
        JSON_BUILD_OBJECT(                                -- body (JSON)
          'type', 'assignment',
          'feedbackId', NEW.feedback_id,
          'formId', feedback_record.form_id,
          'assigneeId', NEW.assigned_to,
          'assigneeEmail', assignee_email, 
          'assigneeName', assignee_name,
          'senderId', NEW.sender_id,
          'senderName', sender_name,
          'senderEmail', sender_email,
          'timestamp', NEW.created_at,
          'meta', NEW.meta
        )::text,
        5                                                 -- timeout in seconds
      ));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger first if it exists
DROP TRIGGER IF EXISTS on_feedback_assignment ON feedback_replies;

-- Create trigger on the feedback_replies table
CREATE TRIGGER on_feedback_assignment
AFTER INSERT ON feedback_replies
FOR EACH ROW
EXECUTE FUNCTION notify_assignment_webhook();

-- Add comment explaining the trigger
COMMENT ON TRIGGER on_feedback_assignment ON feedback_replies IS 
  'Trigger to notify the assignment webhook when a user is assigned to a feedback ticket'; 