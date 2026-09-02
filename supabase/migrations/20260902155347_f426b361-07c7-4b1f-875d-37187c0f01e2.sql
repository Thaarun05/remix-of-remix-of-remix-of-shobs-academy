DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text LIKE '%public%'
      AND (
        coalesce(qual,'') ~ '(has_role|get_user_role|is_conversation_participant|is_admin_teacher_conv_participant)'
        OR coalesce(with_check,'') ~ '(has_role|get_user_role|is_conversation_participant|is_admin_teacher_conv_participant)'
      )
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;