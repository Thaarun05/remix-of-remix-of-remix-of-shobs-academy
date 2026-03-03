
-- Update student RLS policy to only show notes assigned to them
DROP POLICY "Students can view assigned teacher notes" ON public.notes;
CREATE POLICY "Students can view assigned teacher notes"
ON public.notes FOR SELECT
USING (
  (student_user_id = auth.uid()::text)
  AND (deleted_at IS NULL)
);
