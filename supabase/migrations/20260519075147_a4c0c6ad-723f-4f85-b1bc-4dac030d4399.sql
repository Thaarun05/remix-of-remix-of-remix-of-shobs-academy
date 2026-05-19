
CREATE TABLE IF NOT EXISTS public.admin_teacher_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, teacher_user_id)
);

CREATE TABLE IF NOT EXISTS public.admin_teacher_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.admin_teacher_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  receiver_user_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atm_conv ON public.admin_teacher_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_atm_receiver_unread ON public.admin_teacher_messages(receiver_user_id) WHERE read_at IS NULL;

ALTER TABLE public.admin_teacher_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_teacher_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_teacher_conv_participant(_user_id uuid, _conv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_teacher_conversations
    WHERE id = _conv_id AND (admin_user_id = _user_id OR teacher_user_id = _user_id)
  )
$$;

CREATE POLICY "admins manage atc" ON public.admin_teacher_conversations
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "participants view atc" ON public.admin_teacher_conversations
  FOR SELECT USING (admin_user_id = auth.uid() OR teacher_user_id = auth.uid());

CREATE POLICY "admin creates atc" ON public.admin_teacher_conversations
  FOR INSERT WITH CHECK (admin_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage atm" ON public.admin_teacher_messages
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "participants view atm" ON public.admin_teacher_messages
  FOR SELECT USING (public.is_admin_teacher_conv_participant(auth.uid(), conversation_id));

CREATE POLICY "participants send atm" ON public.admin_teacher_messages
  FOR INSERT WITH CHECK (
    sender_user_id = auth.uid()
    AND public.is_admin_teacher_conv_participant(auth.uid(), conversation_id)
  );

CREATE POLICY "receiver marks read atm" ON public.admin_teacher_messages
  FOR UPDATE USING (receiver_user_id = auth.uid()) WITH CHECK (receiver_user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_teacher_messages;
ALTER TABLE public.admin_teacher_messages REPLICA IDENTITY FULL;
