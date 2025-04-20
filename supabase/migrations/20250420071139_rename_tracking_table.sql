/*
  # Rename and update docs_scraping_processes table
  
  1. Changes
    - Rename firecrawl_scraping_processes to docs_scraping_processes
    - Update comments and indexes to match the new name
    - Remove owner_id based permissions
    - Make permissions solely based on admin vs agent roles
    - Admins have full access, agents have read-only access
*/

-- Rename the table
ALTER TABLE firecrawl_scraping_processes RENAME TO docs_scraping_processes;

-- Update the comment on the table
COMMENT ON TABLE docs_scraping_processes IS 'Tracks document scraping processes for AI automation. Access model: Admins have full control, agents have read-only access.';

-- Rename the indexes
ALTER INDEX idx_firecrawl_processes_form_id RENAME TO idx_docs_processes_form_id;
ALTER INDEX idx_firecrawl_processes_status RENAME TO idx_docs_processes_status;

-- Rename the trigger
ALTER TRIGGER set_firecrawl_process_completed_at 
ON docs_scraping_processes
RENAME TO set_docs_process_completed_at;

-- Update the function name (fixed syntax)
ALTER FUNCTION update_firecrawl_process_completed_at
RENAME TO update_docs_process_completed_at;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their form's scraping processes" ON docs_scraping_processes;
DROP POLICY IF EXISTS "Users can manage their form's scraping processes" ON docs_scraping_processes;

-- Create role-based policies

-- Agents (any collaborator) can only view scraping processes
CREATE POLICY "Agents can view scraping processes"
ON docs_scraping_processes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM form_collaborators
    WHERE form_collaborators.form_id = docs_scraping_processes.form_id
    AND form_collaborators.user_id = auth.uid()
    AND form_collaborators.invitation_accepted = true
  )
);

-- Only admins can manage (create, update, delete) scraping processes
CREATE POLICY "Admins can manage scraping processes"
ON docs_scraping_processes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM form_collaborators
    WHERE form_collaborators.form_id = docs_scraping_processes.form_id
    AND form_collaborators.user_id = auth.uid()
    AND form_collaborators.role = 'admin'
    AND form_collaborators.invitation_accepted = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM form_collaborators
    WHERE form_collaborators.form_id = docs_scraping_processes.form_id
    AND form_collaborators.user_id = auth.uid()
    AND form_collaborators.role = 'admin'
    AND form_collaborators.invitation_accepted = true
  )
); 