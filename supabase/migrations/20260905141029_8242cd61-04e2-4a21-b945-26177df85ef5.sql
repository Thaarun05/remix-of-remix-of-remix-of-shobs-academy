CREATE TABLE public.student_fee_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id UUID NOT NULL,
  teacher_user_id UUID NOT NULL,
  fee_collected NUMERIC,
  fee_given NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_user_id, teacher_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_fee_settings TO authenticated;
GRANT ALL ON public.student_fee_settings TO service_role;
ALTER TABLE public.student_fee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage student fee settings" ON public.student_fee_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_student_fee_settings_updated_at BEFORE UPDATE ON public.student_fee_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();