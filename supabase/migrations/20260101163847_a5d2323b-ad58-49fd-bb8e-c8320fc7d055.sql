-- A) Global Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  recipient_id uuid NOT NULL,
  sender_id uuid,
  role_target text,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_table text,
  entity_id uuid,
  is_read boolean DEFAULT false
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS: Recipients can view/update their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (recipient_id = auth.uid());

CREATE POLICY "Users can mark their notifications as read"
ON public.notifications FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "Admins can view all notifications"
ON public.notifications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- B) Add assigned_teacher_id to student_profiles
ALTER TABLE public.student_profiles 
ADD COLUMN IF NOT EXISTS assigned_teacher_id uuid;

-- C) Add soft-delete columns to messages
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by uuid,
ADD COLUMN IF NOT EXISTS deleted_for_role text;

-- D) Student fees table (Teacher -> Admin -> Student workflow)
CREATE TABLE public.student_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  month text NOT NULL,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  total_hours numeric,
  fee_per_hour numeric,
  subjects text,
  class_dates text,
  status text DEFAULT 'sent_to_admin',
  admin_viewed_at timestamptz,
  student_ack_status text
);

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all student fees"
ON public.student_fees FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view and create fees"
ON public.student_fees FOR SELECT
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert fees"
ON public.student_fees FOR INSERT
WITH CHECK (teacher_id = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Students can view their own fees"
ON public.student_fees FOR SELECT
USING (student_id = auth.uid() AND status = 'sent_to_student');

CREATE POLICY "Students can update ack status"
ON public.student_fees FOR UPDATE
USING (student_id = auth.uid() AND status = 'sent_to_student')
WITH CHECK (student_id = auth.uid());

-- E) Teacher salary table
CREATE TABLE public.teacher_salary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  teacher_id uuid NOT NULL,
  num_classes int,
  total_hours numeric,
  salary_per_hour numeric,
  amount numeric,
  status text DEFAULT 'sent_to_teacher'
);

ALTER TABLE public.teacher_salary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all teacher salaries"
ON public.teacher_salary FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers can view their own salary"
ON public.teacher_salary FOR SELECT
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their salary status"
ON public.teacher_salary FOR UPDATE
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());