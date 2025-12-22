-- Create storage bucket for assignment files
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-files', 'assignment-files', false);

-- Add file metadata columns to assignments table
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS has_attachments boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS submission_attachments jsonb DEFAULT '[]'::jsonb;

-- Storage policies for assignment-files bucket
-- Policy: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload assignment files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assignment-files');

-- Policy: Teachers can view their assignment files (using path prefix matching)
CREATE POLICY "Teachers can view assignment files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-files' 
  AND (
    -- Teachers can see files for assignments they created
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.teacher_user_id = auth.uid()
      AND (
        name LIKE 'assignments/' || a.id::text || '/%'
        OR name LIKE 'submissions/' || a.id::text || '/%'
      )
    )
  )
);

-- Policy: Students can view files for their assignments
CREATE POLICY "Students can view their assignment files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (
    -- Students can see teacher-uploaded files for their assignments
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.student_user_id = auth.uid()
      AND name LIKE 'assignments/' || a.id::text || '/%'
    )
    OR
    -- Students can see their own submissions
    name LIKE 'submissions/%/' || auth.uid()::text || '/%'
  )
);

-- Policy: Teachers can delete their assignment files
CREATE POLICY "Teachers can delete assignment files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.teacher_user_id = auth.uid()
    AND name LIKE 'assignments/' || a.id::text || '/%'
  )
);

-- Policy: Students can delete their own submission files
CREATE POLICY "Students can delete their submission files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND name LIKE 'submissions/%/' || auth.uid()::text || '/%'
);

-- Policy: Teachers can update files for their assignments
CREATE POLICY "Teachers can update assignment files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.teacher_user_id = auth.uid()
    AND name LIKE 'assignments/' || a.id::text || '/%'
  )
);