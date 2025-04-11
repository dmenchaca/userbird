/*
  # Recreate feedback-images storage policies

  Creates all necessary policies to access feedback images after EU migration:
  - Admin users can manage all feedback images (all operations)
  - Agent users can view all feedback images (SELECT)
  - Collaborators can view feedback images (SELECT)
  - Only the service_role can upload (INSERT)
*/

-- Drop any existing policies for feedback-images bucket
DROP POLICY IF EXISTS "Admin can manage all feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Agent can view all feedback images" ON storage.objects;
DROP POLICY IF EXISTS "Collaborators can view feedback images pgw4ao_0" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload feedback images" ON storage.objects;

-- 1. Admin can manage all feedback images (all operations)
CREATE POLICY "Admin can manage all feedback images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE users.id = auth.uid()
    AND users.raw_app_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE users.id = auth.uid()
    AND users.raw_app_meta_data->>'role' = 'admin'
  )
);

-- 2. Agent can view all feedback images (SELECT)
CREATE POLICY "Agent can view all feedback images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE users.id = auth.uid()
    AND users.raw_app_meta_data->>'role' = 'agent'
  )
);

-- 3. Collaborators can view feedback images (SELECT)
CREATE POLICY "Collaborators can view feedback images pgw4ao_0"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'feedback-images' AND
  EXISTS (
    SELECT 1 
    FROM form_collaborators
    JOIN forms ON (forms.id = form_collaborators.form_id)
    WHERE form_collaborators.user_id = auth.uid()
    AND forms.id = split_part(objects.name, '/', 1)
  )
);

-- 4. Service role can upload feedback images (INSERT)
CREATE POLICY "Service role can upload feedback images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'feedback-images'
);

-- Make sure the bucket is set to private (requires auth/signed URLs)
UPDATE storage.buckets 
SET public = false
WHERE id = 'feedback-images'; 