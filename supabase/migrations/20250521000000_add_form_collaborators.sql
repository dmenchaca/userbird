/*
  # Add form collaborators support

  1. New Tables
    - `form_collaborators`
      - `id` (uuid, primary key)
      - `form_id` (text, references forms)
      - `user_id` (uuid, references auth.users)
      - `role` (text, check constraint for valid roles)
      - `invited_by` (uuid, references auth.users)
      - `invitation_email` (text)
      - `invitation_accepted` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on form_collaborators table
    - Add policies for form owners to manage collaborators
    - Add policies for collaborators to view their own permissions
*/

-- Create form_collaborators table
CREATE TABLE form_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'agent')),
  invited_by uuid REFERENCES auth.users(id),
  invitation_email text,
  invitation_accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(form_id, user_id)
);

-- Enable RLS
ALTER TABLE form_collaborators ENABLE ROW LEVEL SECURITY;

-- Create policies for form owners to manage collaborators
CREATE POLICY "Form owners can manage collaborators"
ON form_collaborators
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_collaborators.form_id
    AND forms.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = form_collaborators.form_id
    AND forms.owner_id = auth.uid()
  )
);

-- Create policy for collaborators to view their own permissions
CREATE POLICY "Users can view forms they are invited to"
ON form_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create indexes for faster lookups
CREATE INDEX idx_form_collaborators_form_id ON form_collaborators(form_id);
CREATE INDEX idx_form_collaborators_user_id ON form_collaborators(user_id); 