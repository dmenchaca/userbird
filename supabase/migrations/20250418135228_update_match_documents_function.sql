-- Drop the existing function
DROP FUNCTION IF EXISTS match_documents;

-- Re-create function with form_id filter option
CREATE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT NULL,
  filter jsonb DEFAULT '{}',
  form_id_filter text DEFAULT NULL
) RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float,
  form_id text
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity,
    documents.form_id
  FROM documents
  WHERE 
    metadata @> filter
    AND (form_id_filter IS NULL OR form_id = form_id_filter)
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 