-- ============================================================
-- Agenda Acadêmica — schema fundacional
-- Postgres padrão: sem recursos proprietários
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE public.class_role AS ENUM ('aluno', 'lider', 'vice_lider');
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TYPE public.membership_status AS ENUM ('ativo', 'inativo', 'removido');
CREATE TYPE public.assignment_type AS ENUM ('atividade', 'prova', 'trabalho', 'seminario', 'outro');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'grace_period', 'blocked', 'canceled');
CREATE TYPE public.payment_method AS ENUM ('pix', 'card');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'canceled', 'expired');
CREATE TYPE public.notification_channel AS ENUM ('email');
CREATE TYPE public.notification_kind AS ENUM (
  'welcome', 'assignment_due', 'exam_due', 'weekly_digest',
  'billing_due', 'billing_blocked', 'payment_confirmed'
);

-- ---------- FUNÇÃO utilitária de updated_at ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER_ROLES (papel global — nunca no profile)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- ============================================================
-- INSTITUTIONS / COURSES / CLASSES
-- ============================================================
CREATE TABLE public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT,
  city TEXT,
  state TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  degree TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);
CREATE INDEX idx_courses_institution ON public.courses(institution_id);
GRANT SELECT ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  semester TEXT NOT NULL,
  starts_on DATE,
  ends_on DATE,
  invite_code TEXT NOT NULL UNIQUE,
  monthly_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  grace_days INTEGER NOT NULL DEFAULT 5 CHECK (grace_days >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_classes_course ON public.classes(course_id);
GRANT SELECT ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CLASS MEMBERS
-- ============================================================
CREATE TABLE public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.class_role NOT NULL DEFAULT 'aluno',
  status public.membership_status NOT NULL DEFAULT 'ativo',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
CREATE INDEX idx_class_members_user ON public.class_members(user_id);
CREATE INDEX idx_class_members_class ON public.class_members(class_id);
GRANT SELECT, INSERT ON public.class_members TO authenticated;
GRANT UPDATE, DELETE ON public.class_members TO authenticated;
GRANT ALL ON public.class_members TO service_role;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

-- Funções de autorização (SECURITY DEFINER evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_class_member(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = _class_id
      AND user_id = auth.uid()
      AND status = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_class(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.class_members
    WHERE class_id = _class_id
      AND user_id = auth.uid()
      AND status = 'ativo'
      AND role IN ('lider', 'vice_lider')
  );
$$;

CREATE OR REPLACE FUNCTION public.my_class_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_id FROM public.class_members
  WHERE user_id = auth.uid() AND status = 'ativo';
$$;

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  professor TEXT,
  schedule TEXT,
  room TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  workload_hours INTEGER CHECK (workload_hours IS NULL OR workload_hours > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subjects_class ON public.subjects(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ASSIGNMENTS
-- ============================================================
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.assignment_type NOT NULL DEFAULT 'atividade',
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  weight NUMERIC(5,2) CHECK (weight IS NULL OR weight >= 0),
  link_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_class_due ON public.assignments(class_id, due_at);
CREATE INDEX idx_assignments_subject ON public.assignments(subject_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ASSIGNMENT COMPLETIONS
-- ============================================================
CREATE TABLE public.assignment_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);
CREATE INDEX idx_completions_user ON public.assignment_completions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_completions TO authenticated;
GRANT ALL ON public.assignment_completions TO service_role;
ALTER TABLE public.assignment_completions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'trial',
  method public.payment_method,
  amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_days INTEGER NOT NULL DEFAULT 5 CHECK (grace_days >= 0),
  blocked_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  provider TEXT,
  provider_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_id)
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  reference_month DATE,
  provider_charge_id TEXT,
  pix_qr_code TEXT,
  pix_copia_e_cola TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_charge_id)
);
CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PAYMENT WEBHOOK EVENTS (idempotência)
-- ============================================================
CREATE TABLE public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  provider_charge_id TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
CREATE INDEX idx_webhook_events_charge ON public.payment_webhook_events(provider_charge_id);
GRANT ALL ON public.payment_webhook_events TO service_role;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  remind_7_days BOOLEAN NOT NULL DEFAULT true,
  remind_3_days BOOLEAN NOT NULL DEFAULT true,
  remind_1_day BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT true,
  billing_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================
CREATE TABLE public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'email',
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
  dedupe_key TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notification_log_user ON public.notification_log(user_id);
GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  summary TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_class ON public.audit_log(class_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_institutions_updated BEFORE UPDATE ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_class_members_updated BEFORE UPDATE ON public.class_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_completions_updated BEFORE UPDATE ON public.assignment_completions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_webhook_events_updated BEFORE UPDATE ON public.payment_webhook_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notif_prefs_updated BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER: cria profile + preferências no signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- profiles
CREATE POLICY "profiles_select_own_or_classmates" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.user_id = profiles.id
      AND cm.class_id IN (SELECT public.my_class_ids())
  )
);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- institutions
CREATE POLICY "institutions_select" ON public.institutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "institutions_admin_all" ON public.institutions FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- courses
CREATE POLICY "courses_select" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "courses_admin_all" ON public.courses FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- classes
CREATE POLICY "classes_select" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "classes_update_managers" ON public.classes FOR UPDATE TO authenticated
USING (public.can_manage_class(id)) WITH CHECK (public.can_manage_class(id));
CREATE POLICY "classes_admin_write" ON public.classes FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- class_members
CREATE POLICY "members_select_same_class" ON public.class_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin() OR class_id IN (SELECT public.my_class_ids()));
CREATE POLICY "members_insert_self" ON public.class_members FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid() AND role = 'aluno') OR public.is_admin());
CREATE POLICY "members_update_managers" ON public.class_members FOR UPDATE TO authenticated
USING (public.can_manage_class(class_id)) WITH CHECK (public.can_manage_class(class_id));
CREATE POLICY "members_delete_managers" ON public.class_members FOR DELETE TO authenticated
USING (public.can_manage_class(class_id));

-- subjects
CREATE POLICY "subjects_select_class" ON public.subjects FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_class_member(class_id));
CREATE POLICY "subjects_insert_managers" ON public.subjects FOR INSERT TO authenticated
WITH CHECK (public.can_manage_class(class_id));
CREATE POLICY "subjects_update_managers" ON public.subjects FOR UPDATE TO authenticated
USING (public.can_manage_class(class_id)) WITH CHECK (public.can_manage_class(class_id));
CREATE POLICY "subjects_delete_managers" ON public.subjects FOR DELETE TO authenticated
USING (public.can_manage_class(class_id));

-- assignments
CREATE POLICY "assignments_select_class" ON public.assignments FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_class_member(class_id));
CREATE POLICY "assignments_insert_managers" ON public.assignments FOR INSERT TO authenticated
WITH CHECK (public.can_manage_class(class_id));
CREATE POLICY "assignments_update_managers" ON public.assignments FOR UPDATE TO authenticated
USING (public.can_manage_class(class_id)) WITH CHECK (public.can_manage_class(class_id));
CREATE POLICY "assignments_delete_managers" ON public.assignments FOR DELETE TO authenticated
USING (public.can_manage_class(class_id));

-- assignment_completions (estritamente próprias)
CREATE POLICY "completions_select_own" ON public.assignment_completions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "completions_insert_own" ON public.assignment_completions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_id AND public.is_class_member(a.class_id)
  )
);
CREATE POLICY "completions_update_own" ON public.assignment_completions FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "completions_delete_own" ON public.assignment_completions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- subscriptions (somente leitura para o usuário)
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin() OR public.can_manage_class(class_id));

-- payments (somente leitura para o usuário)
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- payment_webhook_events: nenhuma policy para authenticated (apenas service_role)

-- notification_preferences
CREATE POLICY "prefs_select_own" ON public.notification_preferences FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "prefs_insert_own" ON public.notification_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "prefs_update_own" ON public.notification_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notification_log
CREATE POLICY "notiflog_select_own" ON public.notification_log FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- audit_log
CREATE POLICY "audit_select_class" ON public.audit_log FOR SELECT TO authenticated
USING (public.is_admin() OR (class_id IS NOT NULL AND public.can_manage_class(class_id)));
CREATE POLICY "audit_insert_actor" ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());