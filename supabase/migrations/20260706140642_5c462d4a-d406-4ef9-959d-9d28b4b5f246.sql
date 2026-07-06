
-- 1) families (create table + grants + RLS enable; policies added after family_members exists)
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  manual_override_pct numeric,
  manual_override_reason text,
  override_set_by uuid,
  override_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage families" ON public.families
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) family_members
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX family_members_active_student_uniq
  ON public.family_members (student_user_id)
  WHERE withdrawn_at IS NULL;
CREATE INDEX family_members_family_idx ON public.family_members (family_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage family_members" ON public.family_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Students can view own family membership" ON public.family_members
  FOR SELECT TO authenticated
  USING (student_user_id = auth.uid());
CREATE TRIGGER family_members_updated_at BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Now that family_members exists, add the "students see own family" policy on families
CREATE POLICY "Students can view own family" ON public.families
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = families.id
        AND fm.student_user_id = auth.uid()
    )
  );

-- 3) sibling_discount_settings (singleton)
CREATE TABLE public.sibling_discount_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  second_child_pct numeric NOT NULL DEFAULT 10,
  third_plus_pct numeric NOT NULL DEFAULT 15,
  family_cap_pct numeric NOT NULL DEFAULT 18,
  per_student_floor_pct numeric NOT NULL DEFAULT 20,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sibling_discount_settings TO authenticated;
GRANT ALL ON public.sibling_discount_settings TO service_role;
ALTER TABLE public.sibling_discount_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Any authenticated can read settings" ON public.sibling_discount_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.sibling_discount_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.sibling_discount_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.sibling_discount_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4) family_discount_overrides (audit log)
CREATE TABLE public.family_discount_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  override_pct numeric,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX family_discount_overrides_family_idx ON public.family_discount_overrides (family_id);
GRANT SELECT, INSERT ON public.family_discount_overrides TO authenticated;
GRANT ALL ON public.family_discount_overrides TO service_role;
ALTER TABLE public.family_discount_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage overrides log" ON public.family_discount_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) student_fees breakdown columns
ALTER TABLE public.student_fees
  ADD COLUMN IF NOT EXISTS base_amount numeric,
  ADD COLUMN IF NOT EXISTS sibling_discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sibling_discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric,
  ADD COLUMN IF NOT EXISTS sibling_rank int,
  ADD COLUMN IF NOT EXISTS family_id uuid,
  ADD COLUMN IF NOT EXISTS discount_override_pct numeric,
  ADD COLUMN IF NOT EXISTS discount_override_reason text,
  ADD COLUMN IF NOT EXISTS discount_override_by uuid;
