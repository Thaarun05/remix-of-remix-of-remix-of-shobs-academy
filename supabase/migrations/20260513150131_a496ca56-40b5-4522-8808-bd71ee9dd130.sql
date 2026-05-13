
-- Create join table for many-to-many student-teacher allocation
CREATE TABLE IF NOT EXISTS public.student_teacher_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  teacher_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_user_id, teacher_user_id)
);

CREATE INDEX IF NOT EXISTS idx_sta_student ON public.student_teacher_assignments(student_user_id);
CREATE INDEX IF NOT EXISTS idx_sta_teacher ON public.student_teacher_assignments(teacher_user_id);

ALTER TABLE public.student_teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all student-teacher assignments"
ON public.student_teacher_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Students can view their own assignments"
ON public.student_teacher_assignments
FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Teachers can view assignments for them"
ON public.student_teacher_assignments
FOR SELECT
USING (teacher_user_id = auth.uid());

-- Backfill from existing single assignments
INSERT INTO public.student_teacher_assignments (student_user_id, teacher_user_id)
SELECT user_id, assigned_teacher_id
FROM public.student_profiles
WHERE assigned_teacher_id IS NOT NULL
ON CONFLICT (student_user_id, teacher_user_id) DO NOTHING;
