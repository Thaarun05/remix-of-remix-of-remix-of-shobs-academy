
CREATE TABLE public.teacher_resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.teacher_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers and admins view resources"
ON public.teacher_resources FOR SELECT
USING (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers insert their own resources"
ON public.teacher_resources FOR INSERT
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND uploaded_by = auth.uid());

CREATE POLICY "Uploader updates own resource"
ON public.teacher_resources FOR UPDATE
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins manage resources"
ON public.teacher_resources FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-resources', 'teacher-resources', false);

CREATE POLICY "Teachers and admins download teacher-resources"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'teacher-resources'
  AND (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Teachers upload teacher-resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'teacher-resources'
  AND has_role(auth.uid(), 'teacher'::app_role)
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Uploader deletes own teacher-resources"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'teacher-resources'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
