
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS furthest_question_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_question_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS question_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_time_spent_seconds int NOT NULL DEFAULT 0;

ALTER TABLE public.quiz_attempts
  ALTER COLUMN submitted_at DROP NOT NULL,
  ALTER COLUMN score DROP NOT NULL,
  ALTER COLUMN total DROP NOT NULL,
  ALTER COLUMN results DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_status_check') THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_status_check
      CHECK (status IN ('in_progress','submitted','expired'));
  END IF;
END $$;

UPDATE public.quiz_attempts SET status = 'submitted' WHERE submitted_at IS NOT NULL AND status <> 'submitted';

CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_in_progress_per_assignment
  ON public.quiz_attempts(quiz_assignment_id)
  WHERE status = 'in_progress';
