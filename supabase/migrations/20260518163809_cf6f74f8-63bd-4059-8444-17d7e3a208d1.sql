-- Restrict teacher_profiles visibility
DROP POLICY IF EXISTS "teacher_profiles_select_authenticated" ON public.teacher_profiles;

-- Tighten student_profiles teacher access to explicit assignment rows only
DROP POLICY IF EXISTS "Teachers can view their assigned students" ON public.student_profiles;

CREATE POLICY "Teachers can view their assigned students"
ON public.student_profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.student_teacher_assignments sta
    WHERE sta.student_user_id = student_profiles.user_id
      AND sta.teacher_user_id = auth.uid()
  )
);