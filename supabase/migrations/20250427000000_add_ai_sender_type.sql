-- Add 'ai' to sender_type_enum
ALTER TYPE sender_type_enum ADD VALUE IF NOT EXISTS 'ai';

-- Comment explaining the change
COMMENT ON TYPE sender_type_enum IS 'Enum for sender types in feedback_replies (admin, user, ai)'; 