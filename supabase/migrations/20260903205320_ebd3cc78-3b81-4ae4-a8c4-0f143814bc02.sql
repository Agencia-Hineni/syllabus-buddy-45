-- Funções de gatilho: ninguém precisa chamar diretamente
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Funções usadas dentro das políticas RLS: precisam de EXECUTE para authenticated,
-- mas nunca para anônimos.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.is_class_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.can_manage_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_class(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.my_class_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_class_ids() TO authenticated;

-- payment_webhook_events é acessível apenas pelo sistema (service_role).
-- Política explícita de negação para deixar a intenção registrada.
CREATE POLICY "webhook_events_no_client_access" ON public.payment_webhook_events
FOR SELECT TO authenticated USING (public.is_admin());