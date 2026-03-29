
CREATE TABLE public.whiteboard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whiteboard_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  student_user_id uuid NOT NULL,
  canvas_state text,
  last_saved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

ALTER TABLE public.whiteboard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own sessions"
  ON public.whiteboard_sessions FOR ALL
  TO authenticated
  USING (teacher_user_id = auth.uid())
  WITH CHECK (teacher_user_id = auth.uid());

CREATE POLICY "Students access own sessions"
  ON public.whiteboard_sessions FOR ALL
  TO authenticated
  USING (student_user_id = auth.uid())
  WITH CHECK (student_user_id = auth.uid());

CREATE POLICY "Admins manage all sessions"
  ON public.whiteboard_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_sessions;
