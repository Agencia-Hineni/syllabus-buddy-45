import type { supabaseAdmin as SupabaseAdmin } from "@/integrations/supabase/client.server";

type AdminClient = typeof SupabaseAdmin;

/**
 * Marca um pagamento como pago e estende o período da assinatura. Usada
 * pelos webhooks de Pix (Efí) e cartão (Stripe) — ambos localizam o
 * pagamento pela mesma chave `(provider, provider_charge_id)`, então a
 * liquidação em si é idêntica para os dois provedores.
 */
export async function settlePayment(
  supabaseAdmin: AdminClient,
  provider: string,
  providerChargeId: string,
): Promise<void> {
  const paymentRes = await supabaseAdmin
    .from("payments")
    .select("id, subscription_id, class_id, status, user_id, amount_cents")
    .eq("provider", provider)
    .eq("provider_charge_id", providerChargeId)
    .maybeSingle();

  if (paymentRes.error) throw new Error(paymentRes.error.message);
  if (!paymentRes.data || paymentRes.data.status === "paid") return; // já processado ou desconhecido

  const now = new Date();
  await supabaseAdmin
    .from("payments")
    .update({ status: "paid", paid_at: now.toISOString() })
    .eq("id", paymentRes.data.id);

  if (!paymentRes.data.subscription_id) return;

  const subRes = await supabaseAdmin
    .from("subscriptions")
    .select("id, current_period_end, class_id")
    .eq("id", paymentRes.data.subscription_id)
    .maybeSingle();
  if (subRes.error || !subRes.data) return;

  const classRes = await supabaseAdmin
    .from("classes")
    .select("grace_days")
    .eq("id", subRes.data.class_id)
    .maybeSingle();
  const graceDays = classRes.data?.grace_days ?? 5;

  const base =
    subRes.data.current_period_end && new Date(subRes.data.current_period_end) > now
      ? new Date(subRes.data.current_period_end)
      : now;
  const nextPeriodEnd = new Date(base);
  nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: nextPeriodEnd.toISOString(),
      grace_days: graceDays,
      blocked_at: null,
    })
    .eq("id", subRes.data.id);

  await notifyPaymentConfirmed(
    supabaseAdmin,
    paymentRes.data.id,
    paymentRes.data.user_id,
    paymentRes.data.amount_cents,
    nextPeriodEnd,
  );
}

async function notifyPaymentConfirmed(
  supabaseAdmin: AdminClient,
  paymentId: string,
  userId: string,
  amountCents: number,
  validUntil: Date,
): Promise<void> {
  const dedupeKey = `payment:${paymentId}`;
  const claim = await supabaseAdmin.from("notification_log").insert({
    user_id: userId,
    kind: "payment_confirmed",
    channel: "email",
    dedupe_key: dedupeKey,
  });
  if (claim.error) return; // já notificado (ou falha não crítica) — não bloqueia a confirmação do pagamento

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email) return;
    const { mailer } = await import("@/lib/mailer/index.server");
    const { paymentConfirmedEmail } = await import("@/lib/notifications/templates.server");
    const { formatDate, formatMoney } = await import("@/lib/format");
    const { subject, html } = paymentConfirmedEmail({
      studentName: profile.full_name ?? "aluno",
      amountFormatted: formatMoney(amountCents),
      validUntilFormatted: formatDate(validUntil.toISOString()),
    });
    await mailer.send({ to: profile.email, subject, html });
  } catch (err) {
    console.error("[pagamentos] falha ao enviar confirmação de pagamento", err);
  }
}
