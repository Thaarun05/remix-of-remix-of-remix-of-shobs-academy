-- Drop the existing policy that lets teachers see all student profiles
DROP POLICY IF EXISTS "Teachers can view all student profiles" ON public.student_profiles;

-- Create a new policy that lets teachers only see their assigned students
CREATE POLICY "Teachers can view their assigned students" 
ON public.student_profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND assigned_teacher_id = auth.uid()
);