
ALTER TABLE public.teacher_work_submissions
  ADD COLUMN IF NOT EXISTS work_date date;

ALTER TABLE public.teacher_work_submissions
  DROP CONSTRAINT IF EXISTS teacher_work_submissions_teacher_user_id_month_key;

ALTER TABLE public.teacher_work_submissions
  DROP COLUMN IF EXISTS month;

ALTER TABLE public.teacher_work_submissions
  ALTER COLUMN work_date SET NOT NULL;

ALTER TABLE public.teacher_work_submissions
  ADD CONSTRAINT teacher_work_submissions_teacher_date_key UNIQUE (teacher_user_id, work_date);
