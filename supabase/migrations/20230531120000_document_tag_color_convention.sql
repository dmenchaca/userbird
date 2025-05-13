-- Migration: document_tag_color_convention
-- Description: Documents that the color column stores the light mode color value as the canonical identifier

-- Add a comment to the color column explaining the convention
COMMENT ON COLUMN public.feedback_tags.color IS 'Stores the canonical light mode hex color value (e.g. #10B981). The application maps this to dark mode variants using the colorOptions array in the codebase.';

-- Add a comment to the table itself for additional context
COMMENT ON TABLE public.feedback_tags IS 'Stores tags that can be assigned to feedback items. The color field uses light mode hex values as canonical identifiers.'; 