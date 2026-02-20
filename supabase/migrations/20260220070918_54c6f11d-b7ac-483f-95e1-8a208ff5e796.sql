
-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own notes
CREATE POLICY "Teachers can insert their own notes"
ON public.notes FOR INSERT
WITH CHECK (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can view their own notes"
ON public.notes FOR SELECT
USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can update their own notes"
ON public.notes FOR UPDATE
USING (teacher_user_id = auth.uid());

CREATE POLICY "Teachers can delete their own notes"
ON public.notes FOR DELETE
USING (teacher_user_id = auth.uid());

-- Students can view notes from their assigned teacher
CREATE POLICY "Students can view assigned teacher notes"
ON public.notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
    AND sp.assigned_teacher_id = notes.teacher_user_id
  )
  AND deleted_at IS NULL
);

-- Admins can manage all notes
CREATE POLICY "Admins can manage all notes"
ON public.notes FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for note files
INSERT INTO storage.buckets (id, name, public) VALUES ('note-files', 'note-files', false);

-- Storage policies
CREATE POLICY "Teachers can upload note files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'note-files' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can view their own note files"
ON storage.objects FOR SELECT
USING (bucket_id = 'note-files' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers can delete their own note files"
ON storage.objects FOR DELETE
USING (bucket_id = 'note-files' AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Students can view assigned teacher note files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-files'
  AND has_role(auth.uid(), 'student')
);

CREATE POLICY "Admins can manage all note files"
ON storage.objects FOR ALL
USING (bucket_id = 'note-files' AND has_role(auth.uid(), 'admin'));
