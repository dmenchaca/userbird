-- Add crawl_timestamp column to documents table for versioning crawl data
ALTER TABLE documents
ADD COLUMN crawl_timestamp timestamptz DEFAULT now(); 