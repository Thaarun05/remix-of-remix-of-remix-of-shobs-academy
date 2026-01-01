-- ============ PROFILES: Block anon, users read own, admin full access ============
-- Drop existing policies that may conflict
DROP POLICY IF EXISTS "profiles_anon_select_block" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

-- Block anon from reading profiles
CREATE POLICY "profiles_anon_select_block"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- ============ DEMO REQUESTS: Ensure admin-only access ============
-- Already has admin policies, but let's ensure anon is blocked
DROP POLICY IF EXISTS "demo_requests_anon_block" ON public.demo_requests;
CREATE POLICY "demo_requests_anon_block"
ON public.demo_requests
FOR SELECT
TO anon
USING (false);

-- ============ TEACHER PROFILES: Block anon, authenticated can read ============
DROP POLICY IF EXISTS "teacher_profiles_anon_select_block" ON public.teacher_profiles;
DROP POLICY IF EXISTS "teacher_profiles_select_authenticated" ON public.teacher_profiles;

-- Block anon reads
CREATE POLICY "teacher_profiles_anon_select_block"
ON public.teacher_profiles
FOR SELECT
TO anon
USING (false);

-- Allow any authenticated user to read teacher profiles (for in-app browsing)
CREATE POLICY "teacher_profiles_select_authenticated"
ON public.teacher_profiles
FOR SELECT
TO authenticated
USING (true);

-- ============ ZOOM LINKS: Block anon, only assigned student or admin can read ============
DROP POLICY IF EXISTS "zoom_links_anon_select_block" ON public.zoom_links;
DROP POLICY IF EXISTS "zoom_links_select_assigned" ON public.zoom_links;

-- Block anon reads
CREATE POLICY "zoom_links_anon_select_block"
ON public.zoom_links
FOR SELECT
TO anon
USING (false);

-- Only assigned student OR admin can read meeting credentials
-- Note: zoom_links uses student_user_id column
CREATE POLICY "zoom_links_select_assigned"
ON public.zoom_links
FOR SELECT
TO authenticated
USING (
  student_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);