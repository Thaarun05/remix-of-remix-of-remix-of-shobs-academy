ALTER TABLE public.teacher_recording_submissions
  ADD COLUMN student_user_id uuid,
  ADD COLUMN student_name text;