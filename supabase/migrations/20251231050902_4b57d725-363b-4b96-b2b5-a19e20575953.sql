-- Drop the public insert policy that allows anyone to insert
DROP POLICY IF EXISTS "Anyone can submit demo requests" ON public.demo_requests;

-- Keep only admin access policies (already exist but let's ensure they're correct)
-- The existing policies are:
-- "Admins can manage demo requests" - ALL with has_role(auth.uid(), 'admin'::app_role) 
-- "Admins can view all demo requests" - SELECT with has_role(auth.uid(), 'admin'::app_role)
-- These are good as-is