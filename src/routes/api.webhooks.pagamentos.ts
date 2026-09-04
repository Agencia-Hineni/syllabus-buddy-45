import { createFileRoute } from "@tanstack/react-router";
import { PaymentsNotConfiguredError } from "@/lib/payments/types";
import type { Json } from "@/integrations/supabase/types";

/**
 * Webhook público de confirmação de pagamento Pix (Efí).
 * Idempotente: cada evento é gravado uma única vez em `payment_webhook_events`
 * (chave única `(provider, event_id)`); reentregas do provedor são
 * reconhecidas com 200 sem reprocessar.
 *
 * O status "pago" nunca é aceito apenas pelo corpo do webhook — sempre se
 * reconsulta a cobrança na API do provedor antes de liberar o acesso.
 */
export const Route = createFileRoute("/api/webhooks/pagamentos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { pixProvider } = await import("@/lib/payments/index.server");

        const rawBody = await request.text();

        const verified = await pixProvider.verifyWebhookSignature(request, rawBody);
        if (!verified) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }
        const event = payload ? pixProvider.parseWebhookEvent(payload) : null;
        if (!event) {
          return new Response("Bad Request", { status: 400 });
        }

        const inserted = await supabaseAdmin
          .from("payment_webhook_events")
          .insert({
            provider: pixProvider.name,
            event_id: event.eventId,
            event_type: event.eventType,
            provider_charge_id: event.providerChargeId,
            payload: payload as Json,
          })
          .select("id")
          .single();

        if (inserted.error) {
          // 23505 = unique_violation: já recebemos e (provavelmente) processamos este evento.
          if (inserted.error.code === "23505") {
            return new Response("OK", { status: 200 });
          }
          console.error("[webhook pagamentos] falha ao gravar evento", inserted.error);
          return new Response("Internal Error", { status: 500 });
        }

        try {
          if (!event.providerChargeId) throw new Error("Evento sem identificador de cobrança");

          const status = await pixProvider.fetchChargeStatus(event.providerChargeId);
          if (status === "paid") {
            await settlePayment(supabaseAdmin, pixProvider.name, event.providerChargeId);
          }

          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", inserted.data.id);
        } catch (err) {
          const message =
            err instanceof PaymentsNotConfiguredError
              ? `${err.message} Evento recebido e registrado, mas não pôde ser confirmado automaticamente.`
              : err instanceof Error
                ? err.message
                : String(err);
          console.error("[webhook pagamentos]", message);
          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ processing_error: message })
            .eq("id", inserted.data.id);
        }

        // Sempre 200: já persistimos o evento, então o provedor não precisa reentregar.
        return new Response("OK", { status: 200 });
      },
    },
  },
});

async function settlePayment(
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
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
  supabaseAdmin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
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
    console.error("[webhook pagamentos] falha ao enviar confirmação de pagamento", err);
  }
}
