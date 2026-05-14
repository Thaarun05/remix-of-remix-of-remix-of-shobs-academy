
-- Per-teacher Zoom links and remove Google Meet column

-- 1) Add teacher_user_id, drop meet_link
ALTER TABLE public.meet_links ADD COLUMN IF NOT EXISTS teacher_user_id uuid;

-- Backfill teacher_user_id from student's assigned teacher (best-effort for legacy rows)
UPDATE public.meet_links m
SET teacher_user_id = sp.assigned_teacher_id
FROM public.student_profiles sp
WHERE m.teacher_user_id IS NULL
  AND sp.user_id = m.student_user_id
  AND sp.assigned_teacher_id IS NOT NULL;

-- Remove rows that still have no teacher (cannot be attributed)
DELETE FROM public.meet_links WHERE teacher_user_id IS NULL;

ALTER TABLE public.meet_links ALTER COLUMN teacher_user_id SET NOT NULL;

-- 2) Replace primary key (was student_user_id) with composite (student_user_id, teacher_user_id)
ALTER TABLE public.meet_links DROP CONSTRAINT IF EXISTS zoom_links_pkey;
ALTER TABLE public.meet_links DROP CONSTRAINT IF EXISTS meet_links_pkey;
ALTER TABLE public.meet_links ADD CONSTRAINT meet_links_pkey PRIMARY KEY (student_user_id, teacher_user_id);

-- 3) Drop Google Meet column (zoom_link becomes the link). Make zoom_link required.
-- Move any data from meet_link into zoom_link if zoom_link is empty.
UPDATE public.meet_links SET zoom_link = meet_link WHERE (zoom_link IS NULL OR zoom_link = '') AND meet_link IS NOT NULL AND meet_link <> '';
ALTER TABLE public.meet_links DROP COLUMN IF EXISTS meet_link;
ALTER TABLE public.meet_links ALTER COLUMN zoom_link SET NOT NULL;

-- 4) Update RLS: teachers should only manage rows they own
DROP POLICY IF EXISTS "Teachers can manage zoom links" ON public.meet_links;
CREATE POLICY "Teachers can manage their own zoom links"
ON public.meet_links
FOR ALL
TO authenticated
USING (teacher_user_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'::public.app_role))
WITH CHECK (teacher_user_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'::public.app_role));
