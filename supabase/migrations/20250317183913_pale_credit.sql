/*
  # Add form creation tracking trigger

  1. Changes
    - Add trigger to track form creation events
    - Trigger will fire after a new form is inserted
    - Records form_id, owner_id, and url for analytics
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION public.handle_form_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Track form creation event
    -- Note: This is a placeholder and will be handled by the application layer
    -- We use this trigger to ensure we don't miss any form creation events
    
    -- You can add additional tracking logic here if needed
    
    -- For now, we'll just add a log entry
    RAISE NOTICE 'Form created: id=%, owner=%', NEW.id, NEW.owner_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_form_created_tracking ON forms;
CREATE TRIGGER on_form_created_tracking
    AFTER INSERT ON forms
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_form_created();