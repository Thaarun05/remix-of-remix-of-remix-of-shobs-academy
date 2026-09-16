-- Sibling relationship helper
CREATE OR REPLACE FUNCTION public.is_family_sibling(_viewer uuid, _student uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members a
    JOIN public.family_members b ON a.family_id = b.family_id
    WHERE a.student_user_id = _viewer
      AND b.student_user_id = _student
      AND a.withdrawn_at IS NULL
      AND b.withdrawn_at IS NULL
  )
$$;

-- Children of the signed-in student's family (includes self)
CREATE OR REPLACE FUNCTION public.get_family_children()
RETURNS TABLE(user_id uuid, student_name text, grade text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.user_id, sp.student_name, sp.grade
  FROM public.student_profiles sp
  WHERE sp.user_id = auth.uid()
     OR public.is_family_sibling(auth.uid(), sp.user_id)
$$;

GRANT EXECUTE ON FUNCTION public.get_family_children() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_sibling(uuid, uuid) TO authenticated;

-- Sibling read access for the parent view
CREATE POLICY "Siblings can view attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (public.is_family_sibling(auth.uid(), student_user_id));

CREATE POLICY "Siblings can view assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.is_family_sibling(auth.uid(), student_user_id));

CREATE POLICY "Siblings can view quiz assignments"
  ON public.quiz_assignments FOR SELECT TO authenticated
  USING (public.is_family_sibling(auth.uid(), student_user_id));

CREATE POLICY "Siblings can view quiz attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (public.is_family_sibling(auth.uid(), student_user_id));

CREATE POLICY "Siblings can view fees"
  ON public.student_fees FOR SELECT TO authenticated
  USING (public.is_family_sibling(auth.uid(), student_id));

CREATE POLICY "Siblings can view student profile"
  ON public.student_profiles FOR SELECT TO authenticated
  USING (public.is_family_sibling(auth.uid(), user_id));

-- Parent <-> admin messaging
CREATE TABLE public.parent_admin_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, admin_user_id)
);

GRANT SELECT, INSERT ON public.parent_admin_conversations TO authenticated;
GRANT ALL ON public.parent_admin_conversations TO service_role;
ALTER TABLE public.parent_admin_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view parent conversations"
  ON public.parent_admin_conversations FOR SELECT TO authenticated
  USING (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants can create parent conversations"
  ON public.parent_admin_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.parent_admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.parent_admin_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  receiver_user_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.parent_admin_messages TO authenticated;
GRANT ALL ON public.parent_admin_messages TO service_role;
ALTER TABLE public.parent_admin_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_parent_admin_conv_participant(_user_id uuid, _conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_admin_conversations
    WHERE id = _conv_id
      AND (student_user_id = _user_id OR public.has_role(_user_id, 'admin'::app_role))
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_parent_admin_conv_participant(uuid, uuid) TO authenticated;

CREATE POLICY "Participants can read parent messages"
  ON public.parent_admin_messages FOR SELECT TO authenticated
  USING (public.is_parent_admin_conv_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send parent messages"
  ON public.parent_admin_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND public.is_parent_admin_conv_participant(auth.uid(), conversation_id)
  );

CREATE POLICY "Receivers can mark parent messages read"
  ON public.parent_admin_messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = receiver_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.enforce_parent_admin_message_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.receiver_user_id IS DISTINCT FROM OLD.receiver_user_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only read_at may be updated';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_parent_admin_messages_scope
  BEFORE UPDATE ON public.parent_admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_admin_message_update_scope();

ALTER TABLE public.parent_admin_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_admin_messages;