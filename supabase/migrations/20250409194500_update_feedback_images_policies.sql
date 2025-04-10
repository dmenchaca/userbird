/*
  # Update feedback-images storage policies

  Changes:
  - Drop existing policies
  - Create role-based policies:
    - Admin users can manage all feedback images (all operations)
    - Agent users can view all feedback images (SELECT)
    - Only the service_role can upload (INSERT)
  - Make the feedback-images bucket private (requires auth/signed URLs)
*/

-- Drop existing policies for feedback-images bucket
DROP POLICY IF EXISTS "Collaborators can view feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Form owners can manage feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Form owners can manage feedback images pgw4ao_1" ON storage.objects;
DROP POLICY IF EXISTS "Form owners can manage feedback images pgw4ao_2" ON storage.objects;
DROP POLICY IF EXISTS "Form owners can manage feedback images pgw4ao_3" ON storage.objects;
DROP POLICY IF EXISTS "Widget can upload feedback images pgw4ao_0" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Widget can upload feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage feedback images for their forms" ON storage.objects;
DROP POLICY IF EXISTS "Agent can view feedback images for their forms" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage all feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Agent can view all feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Feedback function can upload images" ON storage.objects;

-- Create new policies based on user roles

-- Admin can manage all feedback images (all operations)
CREATE POLICY "Admin can manage all feedback images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- Agent can view all feedback images (SELECT)
CREATE POLICY "Agent can view all feedback images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'role' = 'agent'
  )
);

-- Only the service_role can upload (INSERT)
CREATE POLICY "Service role can upload feedback images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'feedback-images'
);

-- Make the bucket private (requires auth/signed URLs for access)
-- Access is provided through the feedback-images Edge Function
-- See: supabase/functions/feedback-images/
UPDATE storage.buckets 
SET public = false
WHERE id = 'feedback-images'; 