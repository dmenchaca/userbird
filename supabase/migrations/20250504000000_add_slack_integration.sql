/*
  # Add Slack Integration Table
  
  1. New Table
    - `slack_integrations`
      - `id` (uuid, primary key)
      - `form_id` (text, references forms)
      - `enabled` (boolean)
      - `workspace_id` (text) - Slack workspace ID
      - `channel_id` (text) - Slack channel ID
      - `bot_token` (text) - Encrypted Slack bot token
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - Unique constraint on form_id

  2. Security
    - Enable RLS on the slack_integrations table
    - Add policies for form owners and admin collaborators
*/

-- Create the slack_integrations table
CREATE TABLE IF NOT EXISTS slack_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  workspace_id text,
  workspace_name text,
  channel_id text,
  channel_name text,
  bot_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(form_id)
);

-- Add comment explaining the table
COMMENT ON TABLE slack_integrations IS 
  'Stores Slack integration settings for forms';

-- Enable RLS
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

-- Revoke direct public access
REVOKE ALL ON slack_integrations FROM public;

-- Create policy for form owners to manage their Slack integrations
CREATE POLICY "Form owners can manage slack_integrations"
ON slack_integrations
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT id FROM forms WHERE owner_id = auth.uid()
  )
);

-- Create policy for admin collaborators to manage Slack integrations
CREATE POLICY "Admin collaborators can manage slack_integrations"
ON slack_integrations
FOR ALL
TO authenticated
USING (
  form_id IN (
    SELECT form_id FROM form_collaborators
    WHERE user_id = auth.uid()
    AND role = 'admin'
    AND invitation_accepted = true
  )
);

-- Grant permissions to authenticated users (restricted by policies)
GRANT ALL ON slack_integrations TO authenticated; 