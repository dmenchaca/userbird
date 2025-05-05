-- Add unique constraint to slack_ts in meta field for FUTURE insertions
-- This prevents duplicate processing of the same Slack event

-- First, create a function to check if slack_ts already exists before insertion
CREATE OR REPLACE FUNCTION prevent_duplicate_slack_ts()
RETURNS TRIGGER AS $$
BEGIN
  -- Using FOR UPDATE SKIP LOCKED to handle concurrent inserts
  PERFORM 1 FROM feedback_replies 
  WHERE meta->>'slack_ts' = NEW.meta->>'slack_ts'
  AND meta->>'slack_ts' IS NOT NULL
  FOR UPDATE SKIP LOCKED;
  
  IF FOUND THEN
    RAISE EXCEPTION 'Duplicate slack_ts value: %', NEW.meta->>'slack_ts';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Clean up any existing trigger with the same name
DROP TRIGGER IF EXISTS prevent_duplicate_slack_ts_trigger ON feedback_replies;

-- Create the trigger to enforce uniqueness
CREATE TRIGGER prevent_duplicate_slack_ts_trigger
BEFORE INSERT ON feedback_replies
FOR EACH ROW
WHEN (NEW.meta->>'slack_ts' IS NOT NULL)
EXECUTE FUNCTION prevent_duplicate_slack_ts();

-- Add comment explaining what this trigger does
COMMENT ON TRIGGER prevent_duplicate_slack_ts_trigger ON feedback_replies 
IS 'Prevents inserting duplicate slack_ts values by using row-level locking';

-- Also add a backup index-based constraint if possible
-- First check if any duplicates currently exist
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Check for any existing duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT (meta->>'slack_ts') AS slack_ts
        FROM feedback_replies
        WHERE meta->>'slack_ts' IS NOT NULL
        GROUP BY meta->>'slack_ts'
        HAVING COUNT(*) > 1
    ) AS duplicates;

    -- Only create index if no duplicates exist
    IF duplicate_count = 0 THEN
        -- Try to create a unique index as additional protection
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS feedback_replies_meta_slack_ts_idx ON feedback_replies ((meta->>''slack_ts'')) WHERE meta->>''slack_ts'' IS NOT NULL';
    END IF;
END $$; 