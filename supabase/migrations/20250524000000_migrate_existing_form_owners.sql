/*
  # Migrate existing form owners to form_collaborators

  1. Changes
    - Add existing form owners to form_collaborators table as admins
    - Mark their invitations as accepted
    - Ensures backward compatibility with the new collaboration system

  2. Logic
    - For each form, create a record in form_collaborators for the owner
    - Set the role to 'admin'
    - Set invitation_accepted to true
*/

-- Add existing form owners to the form_collaborators table
-- but only if they don't already exist in the table
INSERT INTO form_collaborators (
  form_id,
  user_id,
  role,
  invited_by,
  invitation_email,
  invitation_accepted,
  created_at,
  updated_at
)
SELECT 
  f.id,
  f.owner_id,
  'admin',
  f.owner_id,
  u.email,
  true,
  f.created_at,
  NOW()
FROM 
  forms f
JOIN 
  auth.users u ON f.owner_id = u.id
WHERE 
  NOT EXISTS (
    SELECT 1 
    FROM form_collaborators fc 
    WHERE fc.form_id = f.id AND fc.user_id = f.owner_id
  )
  AND f.owner_id IS NOT NULL; 