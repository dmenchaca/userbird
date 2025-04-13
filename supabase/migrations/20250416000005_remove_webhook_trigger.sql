/*
  # Remove Assignment Notification Webhook Trigger
  
  This migration removes the problematic database trigger in favor of handling
  notifications directly from the application code.
*/

-- Remove the trigger
DROP TRIGGER IF EXISTS on_feedback_assignment ON feedback_replies;

-- Drop the function
DROP FUNCTION IF EXISTS notify_assignment_webhook(); 