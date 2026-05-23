ALTER TABLE public.teacher_resources
  ADD COLUMN IF NOT EXISTS class_label text,
  ADD COLUMN IF NOT EXISTS subject text;