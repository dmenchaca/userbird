-- Add bot_user_id column to slack_integrations table
ALTER TABLE slack_integrations 
ADD COLUMN IF NOT EXISTS bot_user_id TEXT;

-- Comment the column
COMMENT ON COLUMN slack_integrations.bot_user_id IS 'The Slack user ID of the bot for this integration, used for detecting mentions';

-- For existing integrations, we'll set the bot_user_id when next used 
-- via the auth.test API call in the slack-events function 