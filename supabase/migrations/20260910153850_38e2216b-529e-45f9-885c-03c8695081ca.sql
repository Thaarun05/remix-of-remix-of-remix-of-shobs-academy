
CREATE OR REPLACE FUNCTION public.enforce_attendance_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.teacher_user_id IS DISTINCT FROM OLD.teacher_user_id THEN
    RAISE EXCEPTION 'Cannot change teacher_user_id';
  END IF;
  IF NEW.student_user_id IS DISTINCT FROM OLD.student_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.student_teacher_assignments
      WHERE student_user_id = NEW.student_user_id AND teacher_user_id = NEW.teacher_user_id
    ) AND NOT EXISTS (
      SELECT 1 FROM public.student_profiles
      WHERE user_id = NEW.student_user_id AND assigned_teacher_id = NEW.teacher_user_id
    ) THEN
      RAISE EXCEPTION 'Attendance can only be moved to a student assigned to you';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.can_notify(_sender uuid, _recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _sender IS NOT NULL
    AND _recipient IS NOT NULL
    AND (
      _sender = _recipient
      OR public.has_role(_sender, 'admin'::app_role)
      OR public.has_role(_recipient, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.student_teacher_assignments sta
        WHERE (sta.student_user_id = _sender AND sta.teacher_user_id = _recipient)
           OR (sta.student_user_id = _recipient AND sta.teacher_user_id = _sender)
      )
      OR EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE (sp.user_id = _sender AND sp.assigned_teacher_id = _recipient)
           OR (sp.user_id = _recipient AND sp.assigned_teacher_id = _sender)
      )
    )
$function$;

REVOKE ALL ON FUNCTION public.can_notify(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users insert notifications as themselves" ON public.notifications;
CREATE POLICY "Users insert notifications to related users"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  (sender_id IS NULL OR sender_id = auth.uid())
  AND public.can_notify(auth.uid(), recipient_id)
);
