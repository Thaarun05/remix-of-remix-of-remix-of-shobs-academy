
-- Rename zoom_links table to meet_links and drop unused columns
ALTER TABLE public.zoom_links RENAME TO meet_links;

-- Drop meeting_id and passcode columns (Google Meet doesn't need them)
ALTER TABLE public.meet_links DROP COLUMN IF EXISTS meeting_id;
ALTER TABLE public.meet_links DROP COLUMN IF EXISTS passcode;

-- Rename meeting_url to meet_link
ALTER TABLE public.meet_links RENAME COLUMN meeting_url TO meet_link;
