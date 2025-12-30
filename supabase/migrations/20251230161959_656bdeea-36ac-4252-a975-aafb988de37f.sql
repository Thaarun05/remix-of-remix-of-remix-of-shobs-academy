-- Create student-admin conversations table
CREATE TABLE public.student_admin_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_user_id, admin_user_id)
);

-- Create student-admin messages table
CREATE TABLE public.student_admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.student_admin_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  receiver_user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create teacher-admin conversations table
CREATE TABLE public.teacher_admin_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_user_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(teacher_user_id, admin_user_id)
);

-- Create teacher-admin messages table
CREATE TABLE public.teacher_admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.teacher_admin_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  receiver_user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.student_admin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_admin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_admin_messages ENABLE ROW LEVEL SECURITY;

-- Create security definer functions for checking conversation participants
CREATE OR REPLACE FUNCTION public.is_student_admin_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_admin_conversations
    WHERE id = _conversation_id
    AND (student_user_id = _user_id OR admin_user_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_admin_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_admin_conversations
    WHERE id = _conversation_id
    AND (teacher_user_id = _user_id OR admin_user_id = _user_id)
  )
$$;

-- RLS policies for student_admin_conversations
CREATE POLICY "Students can view their admin conversations"
ON public.student_admin_conversations
FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Admins can view all student-admin conversations"
ON public.student_admin_conversations
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can create admin conversations"
ON public.student_admin_conversations
FOR INSERT
WITH CHECK (student_user_id = auth.uid() AND has_role(auth.uid(), 'student'));

CREATE POLICY "Admins can create student-admin conversations"
ON public.student_admin_conversations
FOR INSERT
WITH CHECK (admin_user_id = auth.uid() AND has_role(auth.uid(), 'admin'));

-- RLS policies for student_admin_messages
CREATE POLICY "Participants can view student-admin messages"
ON public.student_admin_messages
FOR SELECT
USING (is_student_admin_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send student-admin messages"
ON public.student_admin_messages
FOR INSERT
WITH CHECK (sender_user_id = auth.uid() AND is_student_admin_participant(auth.uid(), conversation_id));

CREATE POLICY "Recipients can mark student-admin messages read"
ON public.student_admin_messages
FOR UPDATE
USING (receiver_user_id = auth.uid())
WITH CHECK (receiver_user_id = auth.uid());

-- RLS policies for teacher_admin_conversations
CREATE POLICY "Teachers can view their admin conversations"
ON public.teacher_admin_conversations
FOR SELECT
USING (teacher_user_id = auth.uid());

CREATE POLICY "Admins can view all teacher-admin conversations"
ON public.teacher_admin_conversations
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers can create admin conversations"
ON public.teacher_admin_conversations
FOR INSERT
WITH CHECK (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can create teacher-admin conversations"
ON public.teacher_admin_conversations
FOR INSERT
WITH CHECK (admin_user_id = auth.uid() AND has_role(auth.uid(), 'admin'));

-- RLS policies for teacher_admin_messages
CREATE POLICY "Participants can view teacher-admin messages"
ON public.teacher_admin_messages
FOR SELECT
USING (is_teacher_admin_participant(auth.uid(), conversation_id));

CREATE POLICY "Participants can send teacher-admin messages"
ON public.teacher_admin_messages
FOR INSERT
WITH CHECK (sender_user_id = auth.uid() AND is_teacher_admin_participant(auth.uid(), conversation_id));

CREATE POLICY "Recipients can mark teacher-admin messages read"
ON public.teacher_admin_messages
FOR UPDATE
USING (receiver_user_id = auth.uid())
WITH CHECK (receiver_user_id = auth.uid());

-- Enable realtime for message tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_admin_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_admin_messages;