/*
  # Add webhook settings table

  1. New Tables
    - `webhook_settings`
      - `id` (uuid, primary key)
      - `form_id` (text, references forms)
      - `enabled` (boolean)
      - `url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `webhook_settings` table
    - Add policies for authenticated users to manage their webhook settings
*/

CREATE TABLE IF NOT EXISTS webhook_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(form_id)
);

ALTER TABLE webhook_settings ENABLE ROW LEVEL SECURITY;

-- Allow users to manage webhook settings for their forms
CREATE POLICY "Users can manage webhook settings for their forms"
  ON webhook_settings
  FOR ALL
  TO authenticated
  USING (
    form_id IN (
      SELECT id FROM forms WHERE owner_id = auth.uid()
    )
  );