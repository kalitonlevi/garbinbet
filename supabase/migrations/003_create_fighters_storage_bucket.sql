-- Create the "fighters" storage bucket (public, so photos are accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fighters', 'fighters', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view fighter photos
CREATE POLICY "Anyone can view fighter photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fighters');

-- Allow admins to upload fighter photos
CREATE POLICY "Admin can upload fighter photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fighters'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to update (upsert) fighter photos
CREATE POLICY "Admin can update fighter photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'fighters'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete fighter photos
CREATE POLICY "Admin can delete fighter photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'fighters'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
