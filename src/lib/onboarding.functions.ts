import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRIAL_DAYS = 7;

export const joinClassByInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.inviteCode.trim().toUpperCase();
    if (!code) throw new Error("Informe o código de convite.");

    // Membership + subscription creation must happen with elevated
    // privileges: the client has no INSERT policy on subscriptions, by
    // design, so a student can never grant themselves access.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: klass, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id, name, is_active, monthly_price_cents, grace_days")
      .eq("invite_code", code)
      .maybeSingle();
    if (classError) throw new Error(classError.message);
    if (!klass || !klass.is_active) throw new Error("Código de convite inválido.");

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("class_members")
      .select("id, class_id")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      throw new Error(
        existing.class_id === klass.id
          ? "Você já está nesta turma."
          : "Você já está em outra turma. Fale com um administrador para trocar de turma.",
      );
    }

    const { error: memberError } = await supabaseAdmin.from("class_members").insert({
      class_id: klass.id,
      user_id: userId,
      role: "aluno",
      status: "ativo",
    });
    if (memberError) throw new Error(memberError.message);

    // Free classes (monthly_price_cents = 0) never need a subscription row.
    if (klass.monthly_price_cents > 0) {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

      const { error: subscriptionError } = await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        class_id: klass.id,
        status: "trial",
        amount_cents: klass.monthly_price_cents,
        grace_days: klass.grace_days,
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
      });
      if (subscriptionError) throw new Error(subscriptionError.message);
    }

    return { className: klass.name };
  });
