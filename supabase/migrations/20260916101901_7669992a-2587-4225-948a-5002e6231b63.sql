
-- 1) Sibling discount settings: admin-only read
DROP POLICY IF EXISTS "Any authenticated can read settings" ON public.sibling_discount_settings;
CREATE POLICY "Admins read settings" ON public.sibling_discount_settings
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Assignment files upload: bind to caller, authenticated only
DROP POLICY IF EXISTS "Auth users upload assignment files to own folder" ON storage.objects;
CREATE POLICY "Auth users upload assignment files to own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-files'
  AND owner_id = (select auth.uid())::text
  AND (
    (public.has_role((select auth.uid()), 'teacher'::app_role) AND name LIKE 'assignments/%')
    OR name LIKE ('submissions/%/' || (select auth.uid())::text || '/%')
  )
);

-- 3) Students read assignment files: owner-bound or own submissions or own assignment
DROP POLICY IF EXISTS "Students can view their assignment files" ON storage.objects;
CREATE POLICY "Students can view their assignment files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (
    owner_id = (select auth.uid())::text
    OR name LIKE ('submissions/%/' || (select auth.uid())::text || '/%')
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.student_user_id = (select auth.uid())
        AND objects.name LIKE ('assignments/' || a.id::text || '/%')
    )
  )
);

-- 4) Students delete their submission files: owner-bound
DROP POLICY IF EXISTS "Students can delete their submission files" ON storage.objects;
CREATE POLICY "Students can delete their submission files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND owner_id = (select auth.uid())::text
  AND name LIKE ('submissions/%/' || (select auth.uid())::text || '/%')
);
