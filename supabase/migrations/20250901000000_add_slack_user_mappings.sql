-- Migration: add_slack_user_mappings_table
-- Description: Creates the table for mapping Slack users to Userbird users and updates slack_integrations

-- Create the table for mapping Slack users to Userbird users
CREATE TABLE IF NOT EXISTS slack_user_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slack_workspace_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  slack_user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slack_workspace_id),
  UNIQUE(slack_workspace_id, slack_user_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_slack_ids ON slack_user_mappings(slack_workspace_id, slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mappings_user_id ON slack_user_mappings(user_id);

-- Add metadata column to slack_integrations if it doesn't exist already
ALTER TABLE slack_integrations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Comment the tables and columns
COMMENT ON TABLE slack_user_mappings IS 'Maps Userbird users to Slack users for direct reply functionality';
COMMENT ON COLUMN slack_user_mappings.user_id IS 'The Userbird user ID';
COMMENT ON COLUMN slack_user_mappings.slack_workspace_id IS 'The Slack workspace ID';
COMMENT ON COLUMN slack_user_mappings.slack_user_id IS 'The Slack user ID';
COMMENT ON COLUMN slack_user_mappings.slack_user_name IS 'The Slack user display name for reference';
COMMENT ON COLUMN slack_integrations.metadata IS 'Additional configuration and state data for the Slack integration';

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_slack_user_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_slack_user_mappings_updated_at
BEFORE UPDATE ON slack_user_mappings
FOR EACH ROW
EXECUTE FUNCTION update_slack_user_mappings_updated_at();

-- Add RLS policies
ALTER TABLE slack_user_mappings ENABLE ROW LEVEL SECURITY;

-- Only workspace admins can see mappings for their workspace
CREATE POLICY select_slack_user_mappings ON slack_user_mappings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM slack_integrations si
    WHERE si.workspace_id = slack_user_mappings.slack_workspace_id
    AND (
      -- Form owner
      EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = si.form_id
        AND f.owner_id = auth.uid()
      )
      OR
      -- Admin collaborator
      EXISTS (
        SELECT 1 FROM form_collaborators fc
        WHERE fc.form_id = si.form_id
        AND fc.user_id = auth.uid()
        AND fc.role = 'admin'
        AND fc.invitation_accepted = true
      )
    )
  )
);

-- Only workspace admins can insert mappings for their workspace
CREATE POLICY insert_slack_user_mappings ON slack_user_mappings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM slack_integrations si
    WHERE si.workspace_id = slack_user_mappings.slack_workspace_id
    AND (
      -- Form owner
      EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = si.form_id
        AND f.owner_id = auth.uid()
      )
      OR
      -- Admin collaborator
      EXISTS (
        SELECT 1 FROM form_collaborators fc
        WHERE fc.form_id = si.form_id
        AND fc.user_id = auth.uid()
        AND fc.role = 'admin'
        AND fc.invitation_accepted = true
      )
    )
  )
);

-- Only workspace admins can update mappings for their workspace
CREATE POLICY update_slack_user_mappings ON slack_user_mappings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM slack_integrations si
    WHERE si.workspace_id = slack_user_mappings.slack_workspace_id
    AND (
      -- Form owner
      EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = si.form_id
        AND f.owner_id = auth.uid()
      )
      OR
      -- Admin collaborator
      EXISTS (
        SELECT 1 FROM form_collaborators fc
        WHERE fc.form_id = si.form_id
        AND fc.user_id = auth.uid()
        AND fc.role = 'admin'
        AND fc.invitation_accepted = true
      )
    )
  )
);

-- Only workspace admins can delete mappings for their workspace
CREATE POLICY delete_slack_user_mappings ON slack_user_mappings 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM slack_integrations si
    WHERE si.workspace_id = slack_user_mappings.slack_workspace_id
    AND (
      -- Form owner
      EXISTS (
        SELECT 1 FROM forms f
        WHERE f.id = si.form_id
        AND f.owner_id = auth.uid()
      )
      OR
      -- Admin collaborator
      EXISTS (
        SELECT 1 FROM form_collaborators fc
        WHERE fc.form_id = si.form_id
        AND fc.user_id = auth.uid()
        AND fc.role = 'admin'
        AND fc.invitation_accepted = true
      )
    )
  )
); 