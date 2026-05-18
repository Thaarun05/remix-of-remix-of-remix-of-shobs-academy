-- Add class_label column to meet_links table
ALTER TABLE public.meet_links
  ADD COLUMN IF NOT EXISTS class_label TEXT DEFAULT NULL;