-- Drop the existing constraint and add a new one that includes 'viewed'
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_status_check CHECK (status = ANY (ARRAY['pending'::text, 'submitted'::text, 'viewed'::text]));