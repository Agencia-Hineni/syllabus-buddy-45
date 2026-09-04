import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";

/**
 * Webhook público de confirmação de pagamento por cartão (Stripe).
 * Mesmo padrão do webhook Pix: evento gravado uma única vez em
 * `payment_webhook_events` (idempotente), status "pago" só é aplicado
 * para o evento `checkout.session.completed` com `payment_status: paid`.
 *
 * Renovações mensais seguintes chegam como `invoice.paid` referenciando a
 * assinatura da Stripe, não o `client_reference_id` do checkout original —
 * esse caminho ainda não está implementado (ver nota no final do arquivo).
 */
export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { cardProvider } = await import("@/lib/payments/index.server");
        const { settlePayment } = await import("@/lib/payments/settlement.server");

        const rawBody = await request.text();

        const verified = await cardProvider.verifyWebhookSignature(request, rawBody);
        if (!verified) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: unknown = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }
        const event = payload ? cardProvider.parseWebhookEvent(payload) : null;
        if (!event) {
          return new Response("Bad Request", { status: 400 });
        }

        const inserted = await supabaseAdmin
          .from("payment_webhook_events")
          .insert({
            provider: cardProvider.name,
            event_id: event.eventId,
            event_type: event.eventType,
            provider_charge_id: event.providerChargeId,
            payload: payload as Json,
          })
          .select("id")
          .single();

        if (inserted.error) {
          if (inserted.error.code === "23505") {
            return new Response("OK", { status: 200 });
          }
          console.error("[webhook stripe] falha ao gravar evento", inserted.error);
          return new Response("Internal Error", { status: 500 });
        }

        try {
          const paidEvent =
            event.eventType === "checkout.session.completed" &&
            (payload as { data?: { object?: { payment_status?: string } } })?.data?.object
              ?.payment_status === "paid";

          if (paidEvent && event.providerChargeId) {
            await settlePayment(supabaseAdmin, cardProvider.name, event.providerChargeId);
          }

          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("id", inserted.data.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[webhook stripe]", message);
          await supabaseAdmin
            .from("payment_webhook_events")
            .update({ processing_error: message })
            .eq("id", inserted.data.id);
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
