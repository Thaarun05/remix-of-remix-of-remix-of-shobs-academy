
CREATE POLICY "Teachers can view teacher profiles"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND role = 'teacher'::app_role
);
