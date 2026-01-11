-- Create student fee invoices table (admin-created)
CREATE TABLE public.student_fee_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_user_id uuid NOT NULL,
  student_name text NOT NULL,
  fee_per_hour numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'correct', 'correction_needed')),
  admin_notes text NULL,
  student_notes text NULL,
  sent_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  created_by_admin_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- Create invoice rows table (line items)
CREATE TABLE public.student_fee_invoice_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.student_fee_invoices(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  topic text NOT NULL DEFAULT '',
  row_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_invoice_rows ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_fee_invoices
-- Admin full access
CREATE POLICY "Admins can manage all invoices"
ON public.student_fee_invoices
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view their own invoices (only if sent)
CREATE POLICY "Students can view their sent invoices"
ON public.student_fee_invoices
FOR SELECT
USING (student_user_id = auth.uid() AND status != 'draft');

-- Students can update only status and notes fields
CREATE POLICY "Students can respond to invoices"
ON public.student_fee_invoices
FOR UPDATE
USING (student_user_id = auth.uid() AND status = 'sent')
WITH CHECK (student_user_id = auth.uid());

-- RLS Policies for student_fee_invoice_rows
-- Admin full access
CREATE POLICY "Admins can manage all invoice rows"
ON public.student_fee_invoice_rows
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Students can view rows for their invoices
CREATE POLICY "Students can view their invoice rows"
ON public.student_fee_invoice_rows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_fee_invoices i
    WHERE i.id = invoice_id
    AND i.student_user_id = auth.uid()
    AND i.status != 'draft'
  )
);

-- Add updated_at trigger for invoices
CREATE TRIGGER update_student_fee_invoices_updated_at
BEFORE UPDATE ON public.student_fee_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_fee_invoices;