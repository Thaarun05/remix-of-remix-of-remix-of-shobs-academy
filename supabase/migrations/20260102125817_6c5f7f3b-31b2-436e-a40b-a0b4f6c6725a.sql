-- Add deleted_at column to tables that need soft delete
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.zoom_links ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.teacher_salary ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add edited content tracking for messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS original_content text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Enable realtime for messages (for edit/delete updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;