-- Add a metadata column of type jsonb to the feedback table
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Comment on the column to document its purpose
COMMENT ON COLUMN public.feedback.metadata IS 'JSON object containing additional metadata about the feedback, such as console logs.';

-- Grant permissions on the new column to authenticated and service roles
GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feedback TO service_role; 