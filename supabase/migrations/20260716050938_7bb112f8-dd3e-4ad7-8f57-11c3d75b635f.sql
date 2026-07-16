
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'prevent_student_profile_privileged_updates()',
    'enforce_assignment_update_scope()',
    'enforce_attendance_update_scope()',
    'enforce_atm_update_scope()',
    'enforce_messages_update_scope()',
    'enforce_student_fees_update_scope()',
    'enforce_student_fee_invoices_update_scope()',
    'enforce_teacher_salary_update_scope()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, PUBLIC', fn);
  END LOOP;
END $$;
