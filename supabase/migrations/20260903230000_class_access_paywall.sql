-- ============================================================
-- Bloqueio por inadimplência aplicado também no banco (RLS), não só
-- na interface. Alunos com assinatura "blocked" perdem a leitura do
-- conteúdo da turma (disciplinas/atividades); líderes, vice-líderes e
-- admin nunca são bloqueados por esta regra (podem seguir gerenciando
-- mesmo com a própria assinatura em atraso). Turmas gratuitas
-- (monthly_price_cents = 0) nunca bloqueiam ninguém.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_class_access(_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR public.can_manage_class(_class_id)
    OR EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      LEFT JOIN public.subscriptions s ON s.class_id = cm.class_id AND s.user_id = cm.user_id
      WHERE cm.class_id = _class_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ativo'
        AND (c.monthly_price_cents = 0 OR s.status IS DISTINCT FROM 'blocked')
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
