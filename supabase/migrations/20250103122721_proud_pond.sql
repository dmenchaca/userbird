/*
  # Add user information fields

  1. New Columns
    - `user_id` (text, nullable) - External user identifier
    - `user_email` (text, nullable) - User's email address
    - `user_name` (text, nullable) - User's name

  2. Changes
    - Add new columns to feedback table
    - Add validation for email format
*/

-- Add user information columns
ALTER TABLE feedback
ADD COLUMN user_id text,
ADD COLUMN user_email text,
ADD COLUMN user_name text;

-- Add email format validation
ALTER TABLE feedback
ADD CONSTRAINT valid_email CHECK (
  user_email IS NULL OR 
  user_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);