-- Description: This migration modifies the foreign key constraint on the documents table
-- to ensure that when a form is deleted, all associated documents are automatically deleted.

-- Drop the existing foreign key constraint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_form_id_fkey";

-- Recreate the constraint with ON DELETE CASCADE
ALTER TABLE "documents" ADD CONSTRAINT "documents_form_id_fkey" 
  FOREIGN KEY ("form_id") 
  REFERENCES "forms"("id") 
  ON DELETE CASCADE;

-- Add comment to clarify the constraint behavior
COMMENT ON CONSTRAINT "documents_form_id_fkey" ON "documents" IS 
  'When a form is deleted, all associated documents are automatically deleted'; 