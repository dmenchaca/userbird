/*
  # Add Firecrawl scraping process tracking
  
  1. Changes
    - Create firecrawl_scraping_processes table
    - Tracks scraping sessions with form_id, URLs, and timestamps
    - Foreign key relationship to forms table
    
  2. Features
    - Records the base URL being scraped
    - Stores scraping date and time
    - Keeps list of all scraped URLs in the process
    - Enables AI automation tracking and management
*/

-- Create table to track Firecrawl scraping processes
CREATE TABLE firecrawl_scraping_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id text NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  base_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  scraped_urls text[] DEFAULT '{}',
  error_message text,
  metadata jsonb DEFAULT '{}'
);

-- Add comment to the table for documentation
COMMENT ON TABLE firecrawl_scraping_processes IS 'Tracks Firecrawl website scraping processes for AI automation';

-- Create index for faster lookups by form_id
CREATE INDEX idx_firecrawl_processes_form_id ON firecrawl_scraping_processes(form_id);

-- Create index for status filtering
CREATE INDEX idx_firecrawl_processes_status ON firecrawl_scraping_processes(status);

-- Enable RLS
ALTER TABLE firecrawl_scraping_processes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their form's scraping processes"
ON firecrawl_scraping_processes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = firecrawl_scraping_processes.form_id
    AND (
      forms.owner_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM form_collaborators
        WHERE form_collaborators.form_id = forms.id
        AND form_collaborators.user_id = auth.uid()
        AND form_collaborators.invitation_accepted = true
      )
    )
  )
);

CREATE POLICY "Users can manage their form's scraping processes"
ON firecrawl_scraping_processes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = firecrawl_scraping_processes.form_id
    AND (
      forms.owner_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM form_collaborators
        WHERE form_collaborators.form_id = forms.id
        AND form_collaborators.user_id = auth.uid()
        AND form_collaborators.role = 'admin'
        AND form_collaborators.invitation_accepted = true
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM forms
    WHERE forms.id = firecrawl_scraping_processes.form_id
    AND (
      forms.owner_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM form_collaborators
        WHERE form_collaborators.form_id = forms.id
        AND form_collaborators.user_id = auth.uid()
        AND form_collaborators.role = 'admin'
        AND form_collaborators.invitation_accepted = true
      )
    )
  )
);

-- Create function to update timestamp on completion
CREATE OR REPLACE FUNCTION update_firecrawl_process_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to 'completed' or 'failed' and completed_at is null
  IF (NEW.status IN ('completed', 'failed') AND OLD.status = 'in_progress' AND NEW.completed_at IS NULL) THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set completed_at when status changes
CREATE TRIGGER set_firecrawl_process_completed_at
BEFORE UPDATE ON firecrawl_scraping_processes
FOR EACH ROW
EXECUTE FUNCTION update_firecrawl_process_completed_at(); 