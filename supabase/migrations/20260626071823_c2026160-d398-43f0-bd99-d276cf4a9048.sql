
-- quizzes
CREATE TABLE public.quizzes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  instructions TEXT,
  time_limit_minutes INT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- quiz_questions
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  number INT NOT NULL,
  topic TEXT,
  difficulty TEXT,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option TEXT NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions(quiz_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- quiz_assignments
CREATE TABLE public.quiz_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  teacher_user_id UUID NOT NULL,
  max_attempts INT,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (quiz_id, student_user_id)
);
CREATE INDEX idx_quiz_assignments_quiz ON public.quiz_assignments(quiz_id);
CREATE INDEX idx_quiz_assignments_student ON public.quiz_assignments(student_user_id);
CREATE INDEX idx_quiz_assignments_teacher ON public.quiz_assignments(teacher_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_assignments TO authenticated;
GRANT ALL ON public.quiz_assignments TO service_role;
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;

-- quiz_attempts
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_assignment_id UUID NOT NULL REFERENCES public.quiz_assignments(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  attempt_number INT NOT NULL,
  answers JSONB,
  results JSONB,
  score INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (quiz_assignment_id, attempt_number)
);
CREATE INDEX idx_quiz_attempts_assignment ON public.quiz_attempts(quiz_assignment_id);
CREATE INDEX idx_quiz_attempts_student ON public.quiz_attempts(student_user_id);
GRANT SELECT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies (after all tables exist so cross-references resolve)
CREATE POLICY "Teachers manage their own quizzes"
ON public.quizzes FOR ALL
USING (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'))
WITH CHECK (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins manage all quizzes"
ON public.quizzes FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view quizzes assigned to them"
ON public.quizzes FOR SELECT
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.quiz_assignments qa
    WHERE qa.quiz_id = quizzes.id AND qa.student_user_id = auth.uid()
  )
);

CREATE POLICY "Teachers manage questions for their own quizzes"
ON public.quiz_questions FOR ALL
USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND q.teacher_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_questions.quiz_id AND q.teacher_user_id = auth.uid()));

CREATE POLICY "Admins manage all quiz questions"
ON public.quiz_questions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Teachers manage their own quiz assignments"
ON public.quiz_assignments FOR ALL
USING (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'))
WITH CHECK (teacher_user_id = auth.uid() AND has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins manage all quiz assignments"
ON public.quiz_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view their own quiz assignments"
ON public.quiz_assignments FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Students can view their own quiz attempts"
ON public.quiz_attempts FOR SELECT
USING (student_user_id = auth.uid());

CREATE POLICY "Teachers can view attempts for their quizzes"
ON public.quiz_attempts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.quiz_assignments qa WHERE qa.id = quiz_attempts.quiz_assignment_id AND qa.teacher_user_id = auth.uid()));

CREATE POLICY "Admins manage all quiz attempts"
ON public.quiz_attempts FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_quizzes_updated_at
BEFORE UPDATE ON public.quizzes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
