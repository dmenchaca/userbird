-- Add bot_token_id column to slack_integrations table for storing Vault reference IDs
ALTER TABLE slack_integrations ADD COLUMN bot_token_id uuid;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN slack_integrations.bot_token_id IS 'Reference ID to the Slack bot token stored in Supabase Vault'; 