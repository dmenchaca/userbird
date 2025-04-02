/*
  Add html_content column to feedback_replies table to store rich formatted content:
  - html_content: Stores the sanitized HTML version of the reply
*/

-- Add html_content column
ALTER TABLE feedback_replies 
ADD COLUMN html_content TEXT;

-- Backfill existing entries (this will set html_content to content, but will be plain text)
UPDATE feedback_replies
SET html_content = content
WHERE html_content IS NULL;

COMMENT ON COLUMN feedback_replies.html_content IS 'Sanitized HTML content of the reply, including links and formatting'; 