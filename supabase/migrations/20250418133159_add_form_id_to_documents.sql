-- Add form_id column to documents table, referencing forms(id)
ALTER TABLE documents
ADD COLUMN form_id text REFERENCES forms(id); 