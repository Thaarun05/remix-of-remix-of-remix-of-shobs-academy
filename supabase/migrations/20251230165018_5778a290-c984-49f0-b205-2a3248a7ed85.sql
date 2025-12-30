-- Drop admin messaging tables and related functions
DROP POLICY IF EXISTS "Participants can view student-admin messages" ON public.student_admin_messages;
DROP POLICY IF EXISTS "Participants can send student-admin messages" ON public.student_admin_messages;
DROP POLICY IF EXISTS "Recipients can mark student-admin messages read" ON public.student_admin_messages;
DROP TABLE IF EXISTS public.student_admin_messages;

DROP POLICY IF EXISTS "Students can view their admin conversations" ON public.student_admin_conversations;
DROP POLICY IF EXISTS "Students can create admin conversations" ON public.student_admin_conversations;
DROP POLICY IF EXISTS "Admins can view all student-admin conversations" ON public.student_admin_conversations;
DROP POLICY IF EXISTS "Admins can create student-admin conversations" ON public.student_admin_conversations;
DROP TABLE IF EXISTS public.student_admin_conversations;

DROP POLICY IF EXISTS "Participants can view teacher-admin messages" ON public.teacher_admin_messages;
DROP POLICY IF EXISTS "Participants can send teacher-admin messages" ON public.teacher_admin_messages;
DROP POLICY IF EXISTS "Recipients can mark teacher-admin messages read" ON public.teacher_admin_messages;
DROP TABLE IF EXISTS public.teacher_admin_messages;

DROP POLICY IF EXISTS "Teachers can view their admin conversations" ON public.teacher_admin_conversations;
DROP POLICY IF EXISTS "Teachers can create admin conversations" ON public.teacher_admin_conversations;
DROP POLICY IF EXISTS "Admins can view all teacher-admin conversations" ON public.teacher_admin_conversations;
DROP POLICY IF EXISTS "Admins can create teacher-admin conversations" ON public.teacher_admin_conversations;
DROP TABLE IF EXISTS public.teacher_admin_conversations;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.is_student_admin_participant(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_teacher_admin_participant(uuid, uuid);