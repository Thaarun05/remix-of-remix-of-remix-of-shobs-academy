
DROP POLICY IF EXISTS "Users can update their own profile except role" ON public.profiles;
CREATE POLICY "Users can update own profile (no role change)"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND role = public.get_user_role(user_id));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile as student only"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid() AND role = 'student'::app_role);

CREATE OR REPLACE FUNCTION public.prevent_student_profile_privileged_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.assigned_teacher_id IS DISTINCT FROM OLD.assigned_teacher_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to modify assigned_teacher_id';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_student_profiles_lock ON public.student_profiles;
CREATE TRIGGER trg_student_profiles_lock BEFORE UPDATE ON public.student_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_student_profile_privileged_updates();

CREATE OR REPLACE FUNCTION public.enforce_assignment_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.teacher_user_id THEN
    IF NEW.teacher_user_id IS DISTINCT FROM OLD.teacher_user_id THEN
      RAISE EXCEPTION 'Cannot change teacher_user_id';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.student_user_id THEN
    IF NEW.student_user_id IS DISTINCT FROM OLD.student_user_id
       OR NEW.teacher_user_id IS DISTINCT FROM OLD.teacher_user_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.attachments IS DISTINCT FROM OLD.attachments THEN
      RAISE EXCEPTION 'Students may only update submission status';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_assignments_scope ON public.assignments;
CREATE TRIGGER trg_assignments_scope BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_update_scope();

CREATE OR REPLACE FUNCTION public.enforce_attendance_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.teacher_user_id IS DISTINCT FROM OLD.teacher_user_id THEN
    RAISE EXCEPTION 'Cannot change teacher_user_id';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_attendance_scope ON public.attendance_records;
CREATE TRIGGER trg_attendance_scope BEFORE UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_update_scope();

CREATE OR REPLACE FUNCTION public.enforce_atm_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
     OR NEW.receiver_user_id IS DISTINCT FROM OLD.receiver_user_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only read_at may be updated';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_atm_scope ON public.admin_teacher_messages;
CREATE TRIGGER trg_atm_scope BEFORE UPDATE ON public.admin_teacher_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_atm_update_scope();

CREATE OR REPLACE FUNCTION public.enforce_messages_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.sender_user_id THEN
    IF NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
       OR NEW.receiver_user_id IS DISTINCT FROM OLD.receiver_user_id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() = OLD.receiver_user_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id
       OR NEW.receiver_user_id IS DISTINCT FROM OLD.receiver_user_id
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.original_content IS DISTINCT FROM OLD.original_content
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Receivers may only mark messages as read';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_messages_scope ON public.messages;
CREATE TRIGGER trg_messages_scope BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_messages_update_scope();

CREATE OR REPLACE FUNCTION public.enforce_student_fees_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.teacher_id THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.student_id THEN
    IF NEW.month IS DISTINCT FROM OLD.month
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
       OR NEW.total_hours IS DISTINCT FROM OLD.total_hours
       OR NEW.fee_per_hour IS DISTINCT FROM OLD.fee_per_hour
       OR NEW.subjects IS DISTINCT FROM OLD.subjects
       OR NEW.class_dates IS DISTINCT FROM OLD.class_dates
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.base_amount IS DISTINCT FROM OLD.base_amount
       OR NEW.sibling_discount_pct IS DISTINCT FROM OLD.sibling_discount_pct
       OR NEW.sibling_discount_amount IS DISTINCT FROM OLD.sibling_discount_amount
       OR NEW.final_amount IS DISTINCT FROM OLD.final_amount
       OR NEW.discount_override_pct IS DISTINCT FROM OLD.discount_override_pct
       OR NEW.family_id IS DISTINCT FROM OLD.family_id THEN
      RAISE EXCEPTION 'Students may only acknowledge fees';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_student_fees_scope ON public.student_fees;
CREATE TRIGGER trg_student_fees_scope BEFORE UPDATE ON public.student_fees
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_fees_update_scope();

CREATE OR REPLACE FUNCTION public.enforce_student_fee_invoices_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.student_user_id THEN
    IF NEW.student_user_id IS DISTINCT FROM OLD.student_user_id
       OR NEW.fee_per_hour IS DISTINCT FROM OLD.fee_per_hour
       OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
       OR NEW.created_by_admin_user_id IS DISTINCT FROM OLD.created_by_admin_user_id
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
       OR NEW.student_name IS DISTINCT FROM OLD.student_name THEN
      RAISE EXCEPTION 'Students may only respond to invoices';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sfi_scope ON public.student_fee_invoices;
CREATE TRIGGER trg_sfi_scope BEFORE UPDATE ON public.student_fee_invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_fee_invoices_update_scope();

CREATE OR REPLACE FUNCTION public.enforce_teacher_salary_update_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;
  IF auth.uid() = OLD.teacher_id THEN
    IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
       OR NEW.num_classes IS DISTINCT FROM OLD.num_classes
       OR NEW.total_hours IS DISTINCT FROM OLD.total_hours
       OR NEW.salary_per_hour IS DISTINCT FROM OLD.salary_per_hour
       OR NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.teacher_name IS DISTINCT FROM OLD.teacher_name THEN
      RAISE EXCEPTION 'Teachers may only update salary status';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_teacher_salary_scope ON public.teacher_salary;
CREATE TRIGGER trg_teacher_salary_scope BEFORE UPDATE ON public.teacher_salary
FOR EACH ROW EXECUTE FUNCTION public.enforce_teacher_salary_update_scope();

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Users insert notifications as themselves"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (sender_id IS NULL OR sender_id = auth.uid()));

DROP POLICY IF EXISTS "Students access own sessions" ON public.whiteboard_sessions;
CREATE POLICY "Students read own sessions"
ON public.whiteboard_sessions FOR SELECT
USING (student_user_id = auth.uid());

DROP POLICY IF EXISTS "Students can view assigned teacher note files" ON storage.objects;
CREATE POLICY "Students view note files for their assigned notes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-files'
  AND EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.storage_path = storage.objects.name
      AND n.student_user_id = auth.uid()::text
      AND n.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Teachers can delete their own note files" ON storage.objects;
CREATE POLICY "Teachers delete own note files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'note-files'
  AND EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.storage_path = storage.objects.name
      AND n.teacher_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Teachers can view their own note files" ON storage.objects;
CREATE POLICY "Teachers view own note files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'note-files'
  AND EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.storage_path = storage.objects.name
      AND n.teacher_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload assignment files" ON storage.objects;
CREATE POLICY "Auth users upload assignment files to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-files'
  AND auth.uid() IS NOT NULL
  AND (
    (public.has_role(auth.uid(), 'teacher'::app_role) AND name LIKE 'assignments/%')
    OR (name LIKE 'submissions/%/' || auth.uid()::text || '/%')
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_teacher_conv_participant(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_teacher_conv_participant(uuid, uuid) TO authenticated, service_role;
