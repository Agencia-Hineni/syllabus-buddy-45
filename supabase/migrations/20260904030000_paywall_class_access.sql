-- Paywall enforcement at the RLS level.
--
-- Until now, subjects_select_class/assignments_select_class only checked
-- is_class_member(), so a blocked (non-paying) student could still read
-- class content directly via the API even though the frontend hid it.
-- has_class_access() closes that gap: admins and managers (líder/vice-líder)
-- always have access; a member of a free class (monthly_price_cents = 0)
-- always has access; a member of a paid class needs a subscription that
-- isn't 'blocked'.

CREATE OR REPLACE FUNCTION public.has_class_access(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR public.can_manage_class(_class_id)
    OR (
      public.is_class_member(_class_id)
      AND (
        EXISTS (
          SELECT 1 FROM public.classes
          WHERE id = _class_id AND monthly_price_cents = 0
        )
        OR EXISTS (
          SELECT 1 FROM public.subscriptions
          WHERE class_id = _class_id
            AND user_id = auth.uid()
            AND status <> 'blocked'
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_class_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_class_access(uuid) TO authenticated;

DROP POLICY IF EXISTS "subjects_select_class" ON public.subjects;
CREATE POLICY "subjects_select_class" ON public.subjects FOR SELECT TO authenticated
USING (public.has_class_access(class_id));

DROP POLICY IF EXISTS "assignments_select_class" ON public.assignments;
CREATE POLICY "assignments_select_class" ON public.assignments FOR SELECT TO authenticated
USING (public.has_class_access(class_id));
