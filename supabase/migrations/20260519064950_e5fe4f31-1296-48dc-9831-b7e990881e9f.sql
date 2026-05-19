
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

CREATE TABLE IF NOT EXISTS public.teacher_work_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL,
  month text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_user_id, month)
);

ALTER TABLE public.teacher_work_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own submissions"
  ON public.teacher_work_submissions FOR SELECT
  USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can insert their own submissions"
  ON public.teacher_work_submissions FOR INSERT
  WITH CHECK (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Admins can manage all submissions"
  ON public.teacher_work_submissions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
