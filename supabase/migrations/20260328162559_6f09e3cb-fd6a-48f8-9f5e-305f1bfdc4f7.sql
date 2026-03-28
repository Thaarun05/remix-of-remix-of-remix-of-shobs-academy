
CREATE TABLE public.whiteboard_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Whiteboard',
  thumbnail_data text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.whiteboard_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their whiteboard shares"
  ON public.whiteboard_shares FOR ALL
  TO authenticated
  USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());

CREATE POLICY "Students can view their whiteboard shares"
  ON public.whiteboard_shares FOR SELECT
  TO authenticated
  USING (student_user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Admins can manage all whiteboard shares"
  ON public.whiteboard_shares FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
