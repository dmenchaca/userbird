/*
  # Fix HTTP Method in Assignment Notification Webhook
  
  This migration updates the assignment notification trigger to explicitly use
  the POST method in the HTTP call with proper content type headers.
*/

-- Update the function with fixed HTTP method
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
  payload TEXT;
  headers TEXT[];
BEGIN
  -- Only fire for new assignment entries from admins
  IF NEW.type = 'assignment' AND NEW.sender_type = 'admin' AND NEW.assigned_to IS NOT NULL THEN
    BEGIN
      -- Hard-code the webhook URL since we can't use database parameters due to permissions
      netlify_function_url := 'https://app.userbird.co/.netlify/functions/send-notification';
      
      -- Get feedback details
      BEGIN
        SELECT * INTO feedback_record FROM feedback WHERE id = NEW.feedback_id;
        EXCEPTION WHEN OTHERS THEN
          -- Log error but continue
          RAISE NOTICE 'Error fetching feedback data: %', SQLERRM;
      END;
      
      -- Get form details
      BEGIN
        IF feedback_record.form_id IS NOT NULL THEN
          SELECT * INTO form_record FROM forms WHERE id = feedback_record.form_id;
        END IF;
        EXCEPTION WHEN OTHERS THEN
          -- Log error but continue
          RAISE NOTICE 'Error fetching form data: %', SQLERRM;
      END;
      
      -- Get assignee email
      BEGIN
        SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) 
        INTO assignee_email, assignee_name
        FROM auth.users 
        WHERE id = NEW.assigned_to;
        EXCEPTION WHEN OTHERS THEN
          -- Log error but continue
          RAISE NOTICE 'Error fetching assignee data: %', SQLERRM;
      END;
      
      -- Get sender info if available
      BEGIN
        SELECT email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) 
        INTO sender_email, sender_name
        FROM auth.users 
        WHERE id = NEW.sender_id;
        EXCEPTION WHEN OTHERS THEN
          -- Log error but continue
          RAISE NOTICE 'Error fetching sender data: %', SQLERRM;
      END;
      
      IF assignee_email IS NOT NULL AND feedback_record.form_id IS NOT NULL THEN
        -- Try to call the webhook, but don't fail if it errors
        BEGIN
          -- Prepare JSON payload
          payload := json_build_object(
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
          )::text;

          -- Set headers explicitly
          headers := ARRAY[
            'Content-Type: application/json',
            'Accept: application/json'
          ];

          -- Make HTTP POST request with explicit method
          PERFORM http_post(
            netlify_function_url,   -- url
            payload,                -- payload
            'application/json',     -- content_type
            headers,                -- headers array
            5000                    -- timeout in ms
          );
          
          RAISE NOTICE 'Successfully sent assignment notification webhook';
          EXCEPTION WHEN OTHERS THEN
            -- Log error but don't fail the trigger
            RAISE NOTICE 'Error calling webhook: %', SQLERRM;
        END;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Catch any other errors in the trigger
      RAISE NOTICE 'Error in assignment notification webhook: %', SQLERRM;
    END;
  END IF;
  
  -- Always return NEW to allow the insert to proceed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 