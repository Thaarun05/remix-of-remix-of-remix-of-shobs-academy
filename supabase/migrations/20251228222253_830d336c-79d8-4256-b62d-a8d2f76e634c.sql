-- Create demo_requests table for tracking demo class signups
CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  student_name text NOT NULL,
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  age text NOT NULL,
  grade text NOT NULL,
  subject text NOT NULL,
  timing text NOT NULL,
  days text NOT NULL,
  phone text NOT NULL,
  status text DEFAULT 'sent'
);

-- Enable RLS
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (anonymous visitors can submit demo requests)
CREATE POLICY "Anyone can submit demo requests"
ON public.demo_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only admins can SELECT (view all submissions)
CREATE POLICY "Admins can view all demo requests"
ON public.demo_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all demo requests
CREATE POLICY "Admins can manage demo requests"
ON public.demo_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));