
CREATE TABLE public.whiteboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id text NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Whiteboard',
  image_data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex')
);

ALTER TABLE public.whiteboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own whiteboards"
ON public.whiteboards FOR ALL
TO authenticated
USING (teacher_user_id = auth.uid()::text AND deleted_at IS NULL)
WITH CHECK (teacher_user_id = auth.uid()::text);

CREATE POLICY "Anyone can view shared whiteboards"
ON public.whiteboards FOR SELECT
USING (share_token IS NOT NULL AND deleted_at IS NULL);
