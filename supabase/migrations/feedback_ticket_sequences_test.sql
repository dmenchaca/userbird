/*
  # Test script for feedback_ticket_sequences RLS policy
  
  This test script verifies that:
  1. RLS is properly enforced on the feedback_ticket_sequences table
  2. The SECURITY DEFINER function can bypass RLS when generating ticket numbers
  3. Admin collaborators can view (but not modify) sequences
  4. Agent collaborators can view (but not modify) sequences
  5. No user (except service_role) can directly modify sequence data
  
  Run this script with psql or from the Supabase SQL editor:
  ```
  psql -f feedback_ticket_sequences_test.sql
  ```
*/

-- Reset state for testing
BEGIN;

-- Set up test users
-- Admin collaborator
INSERT INTO auth.users (id, email) VALUES 
('11111111-1111-1111-1111-111111111111', 'admin@example.com')
ON CONFLICT (id) DO NOTHING;

-- Agent collaborator
INSERT INTO auth.users (id, email) VALUES 
('22222222-2222-2222-2222-222222222222', 'agent@example.com')
ON CONFLICT (id) DO NOTHING;

-- Non-collaborator
INSERT INTO auth.users (id, email) VALUES 
('33333333-3333-3333-3333-333333333333', 'other@example.com')
ON CONFLICT (id) DO NOTHING;

-- Set up test forms
INSERT INTO forms (id, url) 
VALUES ('test-form-1', 'https://example.com/form1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO forms (id, url) 
VALUES ('test-form-2', 'https://example.com/form2')
ON CONFLICT (id) DO NOTHING;

-- Set up collaborator relationships
-- Admin for form 1
INSERT INTO form_collaborators (form_id, user_id, role)
VALUES ('test-form-1', '11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT (form_id, user_id) DO NOTHING;

-- Agent for form 1
INSERT INTO form_collaborators (form_id, user_id, role)
VALUES ('test-form-1', '22222222-2222-2222-2222-222222222222', 'agent')
ON CONFLICT (form_id, user_id) DO NOTHING;

-- Set up test sequence
-- This requires service_role or bypass RLS since we're setting up the test
SET LOCAL ROLE postgres;
INSERT INTO feedback_ticket_sequences (form_id, last_number)
VALUES ('test-form-1', 10), ('test-form-2', 20)
ON CONFLICT (form_id) DO UPDATE SET last_number = EXCLUDED.last_number;

-- Test 1: Admin collaborator access - Can view sequences
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

SELECT 'Test 1: Admin collaborator can view sequences' AS test_name;
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-1';

-- Test 2: Admin collaborator cannot access other sequences
SELECT 'Test 2: Admin collaborator cannot view sequences for other forms' AS test_name;
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-2';

-- Test 3: Admin collaborator cannot directly modify sequences
SELECT 'Test 3: Admin collaborator cannot directly modify sequences' AS test_name;
DO $$
BEGIN
  BEGIN
    UPDATE feedback_ticket_sequences
    SET last_number = 50
    WHERE form_id = 'test-form-1';
    
    RAISE NOTICE 'FAILED: Admin collaborator was able to update the sequence';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASSED: Admin collaborator was prevented from updating the sequence';
  END;
END $$;

-- Test 4: Agent collaborator access - Can view sequences
SET LOCAL "request.jwt.claim.sub" TO '22222222-2222-2222-2222-222222222222';

SELECT 'Test 4: Agent collaborator can view the sequence' AS test_name;
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-1';

-- Test 5: Agent collaborator cannot access sequences for forms they do not collaborate on
SELECT 'Test 5: Agent collaborator cannot view sequences for other forms' AS test_name;
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-2';

-- Test 6: Agent collaborator cannot directly modify sequences
SELECT 'Test 6: Agent collaborator cannot directly modify sequences' AS test_name;
DO $$
BEGIN
  BEGIN
    UPDATE feedback_ticket_sequences
    SET last_number = 50
    WHERE form_id = 'test-form-1';
    
    RAISE NOTICE 'FAILED: Agent collaborator was able to update the sequence';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASSED: Agent collaborator was prevented from updating the sequence';
  END;
END $$;

-- Test 7: Non-collaborator cannot view any sequences
SET LOCAL "request.jwt.claim.sub" TO '33333333-3333-3333-3333-333333333333';

SELECT 'Test 7: Non-collaborator cannot view any sequences' AS test_name;
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-1';
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-2';

-- Test 8: Feedback creation with trigger works (using the SECURITY DEFINER function)
-- Add admin to this form first
SET LOCAL ROLE postgres;
INSERT INTO form_collaborators (form_id, user_id, role)
VALUES ('test-form-2', '11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT (form_id, user_id) DO NOTHING;

-- Switch to admin role
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

SELECT 'Test 8: Trigger with SECURITY DEFINER function works' AS test_name;
INSERT INTO feedback (form_id, message) 
VALUES ('test-form-2', 'Test message')
RETURNING id, form_id, message, ticket_number;

-- Verify sequence was updated
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-2';

-- Test 9: Admin collaborator cannot directly insert a new sequence
SELECT 'Test 9: Admin collaborator cannot directly insert a new sequence' AS test_name;
DO $$
BEGIN
  BEGIN
    INSERT INTO feedback_ticket_sequences (form_id, last_number)
    VALUES ('test-form-new', 1);
    
    RAISE NOTICE 'FAILED: Admin collaborator was able to insert a new sequence';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASSED: Admin collaborator was prevented from inserting a new sequence';
  END;
END $$;

-- Test 10: Ticket generation for a form with no existing sequence works
-- Create a new form and add admin collaborator
SET LOCAL ROLE postgres;
INSERT INTO forms (id, url) 
VALUES ('test-form-3', 'https://example.com/form3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO form_collaborators (form_id, user_id, role)
VALUES ('test-form-3', '11111111-1111-1111-1111-111111111111', 'admin')
ON CONFLICT (form_id, user_id) DO NOTHING;

-- Switch back to admin
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

SELECT 'Test 10: New sequence creation works via function' AS test_name;
INSERT INTO feedback (form_id, message) 
VALUES ('test-form-3', 'First feedback for new form')
RETURNING id, form_id, message, ticket_number;

-- Verify new sequence was created
SELECT * FROM feedback_ticket_sequences WHERE form_id = 'test-form-3';

-- Test 11: Service role can manage sequences directly
SET LOCAL ROLE service_role;

SELECT 'Test 11: Service role can manage sequences directly' AS test_name;
UPDATE feedback_ticket_sequences
SET last_number = 100
WHERE form_id = 'test-form-1'
RETURNING *;

-- Clean up (optional - comment out to keep test data)
-- DELETE FROM feedback WHERE form_id IN ('test-form-1', 'test-form-2', 'test-form-3');
-- DELETE FROM form_collaborators WHERE form_id IN ('test-form-1', 'test-form-2', 'test-form-3');
-- DELETE FROM forms WHERE id IN ('test-form-1', 'test-form-2', 'test-form-3');
-- DELETE FROM feedback_ticket_sequences WHERE form_id IN ('test-form-1', 'test-form-2', 'test-form-3');

ROLLBACK; 