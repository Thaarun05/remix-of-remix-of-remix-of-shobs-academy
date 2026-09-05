
DROP POLICY IF EXISTS "zoom_links_select_assigned" ON public.meet_links;
CREATE POLICY "zoom_links_select_assigned" ON public.meet_links
FOR SELECT TO authenticated
USING (
  student_user_id = auth.uid()
  OR teacher_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Students view note files for their assigned notes" ON storage.objects;
CREATE POLICY "Students view note files for their assigned notes" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'note-files'
  AND EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.storage_path = storage.objects.name
      AND n.deleted_at IS NULL
      AND n.student_user_id IS NOT NULL
      AND n.student_user_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      AND n.student_user_id::uuid = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.enforce_profile_insert_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot create a profile for another user';
  END IF;
  IF NEW.role IS DISTINCT FROM 'student'::app_role THEN
    RAISE EXCEPTION 'Self-created profiles must use the student role';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_insert_scope ON public.profiles;
CREATE TRIGGER trg_profiles_insert_scope
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_insert_scope();

REVOKE ALL ON FUNCTION public.enforce_profile_insert_scope() FROM PUBLIC, anon, authenticated;
