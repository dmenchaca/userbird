/*
  # Create feedback tables

  1. New Tables
    - `forms`
      - `id` (text, primary key) - The unique form identifier
      - `url` (text) - The website URL
      - `created_at` (timestamp)
    - `feedback`
      - `id` (uuid, primary key)
      - `form_id` (text, foreign key to forms.id)
      - `message` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access to forms table
    - Add policies for public access to feedback table
*/

-- Create forms table
CREATE TABLE IF NOT EXISTS forms (
  id text PRIMARY KEY,
  url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text REFERENCES forms(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public form creation"
  ON forms
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public form reading"
  ON forms
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public feedback submission"
  ON feedback
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public feedback reading"
  ON feedback
  FOR SELECT
  TO public
  USING (true);