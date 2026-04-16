DROP POLICY IF EXISTS "Public can read individual gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can list gallery" ON storage.objects;

CREATE POLICY "Anyone can view gallery images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'gallery');
