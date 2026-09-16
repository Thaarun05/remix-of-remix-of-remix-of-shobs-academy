CREATE OR REPLACE FUNCTION public.get_academy_admin()
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, COALESCE(p.full_name, 'Academy Admin')
  FROM public.profiles p
  WHERE p.role = 'admin'::app_role
  ORDER BY p.created_at NULLS LAST
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_academy_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_academy_admin() TO authenticated;