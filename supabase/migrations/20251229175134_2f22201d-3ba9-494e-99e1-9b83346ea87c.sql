-- Create conversations table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_user_id, teacher_user_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  receiver_user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz NULL
);

-- Enable RLS on both tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is part of a conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conversation_id
    AND (student_user_id = _user_id OR teacher_user_id = _user_id)
  )
$$;

-- Conversations RLS policies
-- Students can view their own conversations
CREATE POLICY "Students can view their conversations"
ON public.conversations
FOR SELECT
USING (student_user_id = auth.uid());

-- Teachers can view their conversations
CREATE POLICY "Teachers can view their conversations"
ON public.conversations
FOR SELECT
USING (teacher_user_id = auth.uid());

-- Teachers can create conversations (they initiate with students)
CREATE POLICY "Teachers can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (
  teacher_user_id = auth.uid() 
  AND has_role(auth.uid(), 'teacher'::app_role)
);

-- Admins can manage all conversations
CREATE POLICY "Admins can manage conversations"
ON public.conversations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Messages RLS policies
-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
ON public.messages
FOR SELECT
USING (is_conversation_participant(auth.uid(), conversation_id));

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages in their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND is_conversation_participant(auth.uid(), conversation_id)
);

-- Users can update read_at on messages they received
CREATE POLICY "Users can mark messages as read"
ON public.messages
FOR UPDATE
USING (receiver_user_id = auth.uid())
WITH CHECK (receiver_user_id = auth.uid());

-- Admins can manage all messages
CREATE POLICY "Admins can manage messages"
ON public.messages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;