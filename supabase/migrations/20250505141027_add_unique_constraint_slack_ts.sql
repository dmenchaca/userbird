-- Add unique constraint to slack_ts in meta field
-- This prevents duplicate processing of the same Slack event

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

    -- Raise notice with count of duplicates if any exist
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate slack_ts values. You need to clean these up before adding the constraint.', duplicate_count;
    ELSE
        -- Create expression index for the JSONB path if no duplicates exist
        EXECUTE 'CREATE UNIQUE INDEX feedback_replies_meta_slack_ts_idx ON feedback_replies ((meta->>''slack_ts'')) WHERE meta->>''slack_ts'' IS NOT NULL';
        
        -- Add comment explaining the purpose of the constraint (only if index was created)
        EXECUTE 'COMMENT ON INDEX feedback_replies_meta_slack_ts_idx IS ''Ensures each Slack message is only processed once by the slack-events function''';
    END IF;
END $$; 