CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Role changes are not allowed';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_role_lock ON public.profiles;
CREATE TRIGGER trg_profiles_role_lock
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

CREATE OR REPLACE FUNCTION public.validate_whiteboard_session_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_teacher_assignments
    WHERE student_user_id = NEW.student_user_id AND teacher_user_id = NEW.teacher_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.student_profiles
    WHERE user_id = NEW.student_user_id AND assigned_teacher_id = NEW.teacher_user_id
  ) THEN
    RAISE EXCEPTION 'Teacher is not assigned to this student';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_whiteboard_sessions_validate ON public.whiteboard_sessions;
CREATE TRIGGER trg_whiteboard_sessions_validate
BEFORE INSERT OR UPDATE ON public.whiteboard_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_whiteboard_session_participants();