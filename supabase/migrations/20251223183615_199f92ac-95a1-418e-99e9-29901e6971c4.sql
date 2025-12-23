-- Create events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL CHECK (event_type IN ('class', 'assignment')),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  student_user_id uuid NOT NULL,
  teacher_user_id uuid,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Students can view their own events
CREATE POLICY "Students can view their own events"
ON public.events
FOR SELECT
USING (student_user_id = auth.uid());

-- Teachers can view events they created or are assigned to
CREATE POLICY "Teachers can view their events"
ON public.events
FOR SELECT
USING (teacher_user_id = auth.uid() OR created_by = auth.uid());

-- Teachers can insert events
CREATE POLICY "Teachers can insert events"
ON public.events
FOR INSERT
WITH CHECK (created_by = auth.uid() AND has_role(auth.uid(), 'teacher'::app_role));

-- Teachers can update their own events
CREATE POLICY "Teachers can update their events"
ON public.events
FOR UPDATE
USING (created_by = auth.uid());

-- Teachers can delete their own events
CREATE POLICY "Teachers can delete their events"
ON public.events
FOR DELETE
USING (created_by = auth.uid());

-- Admins can manage all events
CREATE POLICY "Admins can manage all events"
ON public.events
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));