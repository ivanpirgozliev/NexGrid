/*
  # Tighten avatar bucket listing policy

  ## Summary
  - Remove broad public SELECT policy for avatars bucket objects
  - Allow SELECT only for authenticated users on their own avatar folder
  - Keep bucket public for direct avatar URL access
*/

DROP POLICY IF EXISTS "Public can view avatar objects" ON storage.objects;

DROP POLICY IF EXISTS "Users can view own avatars" ON storage.objects;
CREATE POLICY "Users can view own avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = ((SELECT auth.uid())::text)
  );
