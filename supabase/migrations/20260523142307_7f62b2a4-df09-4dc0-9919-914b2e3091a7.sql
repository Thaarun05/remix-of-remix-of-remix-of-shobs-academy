CREATE TABLE public.teacher_recording_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  teacher_name text,
  recording_url text NOT NULL,
  title text NOT NULL,
  class_date date,
  topic text,
  notes text,
  status text NOT NULL DEFAULT 'sent_to_admin',
  admin_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_recording_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers insert own recordings"
ON public.teacher_recording_submissions
FOR INSERT TO public
WITH CHECK (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers view own recordings"
ON public.teacher_recording_submissions
FOR SELECT TO public
USING (teacher_id = auth.uid());

CREATE POLICY "Admins view all recordings"
ON public.teacher_recording_submissions
FOR SELECT TO public
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update recordings"
ON public.teacher_recording_submissions
FOR UPDATE TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_teacher_recording_submissions_status ON public.teacher_recording_submissions(status);
CREATE INDEX idx_teacher_recording_submissions_teacher ON public.teacher_recording_submissions(teacher_id);