DELETE FROM public.student_teacher_assignments sta
WHERE NOT EXISTS (SELECT 1 FROM public.student_profiles sp WHERE sp.user_id = sta.student_user_id);

DELETE FROM public.student_teacher_assignments sta
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = sta.teacher_user_id);

ALTER TABLE public.student_teacher_assignments
  ADD CONSTRAINT student_teacher_assignments_student_user_id_fkey
  FOREIGN KEY (student_user_id)
  REFERENCES public.student_profiles (user_id)
  ON DELETE CASCADE;

ALTER TABLE public.student_teacher_assignments
  ADD CONSTRAINT student_teacher_assignments_teacher_user_id_fkey
  FOREIGN KEY (teacher_user_id)
  REFERENCES public.profiles (user_id)
  ON DELETE CASCADE;

DROP POLICY IF EXISTS "Teachers can view their assigned students" ON public.student_profiles;

CREATE POLICY "Teachers can view their assigned students"
ON public.student_profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    assigned_teacher_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.student_teacher_assignments sta
      WHERE sta.student_user_id = student_profiles.user_id
        AND sta.teacher_user_id = auth.uid()
    )
  )
);