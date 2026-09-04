import { createFileRoute } from "@tanstack/react-router";
import { fetchChargeStatus, parseWebhookPayload } from "@/lib/payments/payment-service";
import { PaymentProviderError } from "@/lib/payments/types";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/webhooks/pagamentos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["EFI_WEBHOOK_SECRET"];
        if (!secret) {
          return new Response("Webhook not configured", { status: 500 });
        }

        const provider = "efi";
        let payload;
        try {
          const body = await request.json();
          payload = await parseWebhookPayload(provider, body, secret, request.headers);
        } catch (error) {
          if (error instanceof PaymentProviderError) {
            return new Response(error.message, { status: 401 });
          }
          return new Response("Invalid payload", { status: 400 });
        }

        if (!payload) {
          return new Response("Ignored", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency: store the event first; if it already exists, skip processing.
        const { data: existing } = await supabaseAdmin
          .from("payment_webhook_events")
          .select("id")
          .eq("provider", provider)
          .eq("event_id", payload.eventId)
          .maybeSingle();

        if (existing) {
          return new Response("Already processed", { status: 200 });
        }

        const { error: insertEventError } = await supabaseAdmin
          .from("payment_webhook_events")
          .insert({
            provider,
            event_id: payload.eventId,
            payload: payload.raw as Json,
            processed_at: new Date().toISOString(),
          });

        if (insertEventError) {
          console.error("Failed to store webhook event", insertEventError);
          return new Response("Failed to store event", { status: 500 });
        }

        // Find the payment and subscription linked to this charge.
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, user_id, class_id, subscription_id, amount_cents, status")
          .eq("provider", provider)
          .eq("provider_charge_id", payload.providerChargeId)
          .maybeSingle();

        if (!payment) {
          return new Response("Payment not found", { status: 404 });
        }

        // The webhook body is only a signal to go check — never the source of
        // truth for money-affecting state. Re-query the provider directly
        // before applying any status change.
        let verifiedStatus;
        try {
          verifiedStatus = await fetchChargeStatus(provider, payload.providerChargeId);
        } catch (error) {
          console.error("Failed to re-verify charge with provider", error);
          return new Response("Could not verify charge with provider", { status: 502 });
        }

        const alreadySettled = payment.status === "paid";

        // Update payment status.
        const { error: paymentError } = await supabaseAdmin
          .from("payments")
          .update({
            status: verifiedStatus,
            paid_at: verifiedStatus === "paid" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (paymentError) {
          console.error("Failed to update payment", paymentError);
          return new Response("Failed to update payment", { status: 500 });
        }

        // On confirmation, extend subscription and unblock the user.
        if (verifiedStatus === "paid" && payment.subscription_id && !alreadySettled) {
          const { data: subscription } = await supabaseAdmin
            .from("subscriptions")
            .select("id, current_period_end, status")
            .eq("id", payment.subscription_id)
            .single();

          const periodEnd = subscription?.current_period_end
            ? new Date(subscription.current_period_end)
            : new Date();

          // Extend by one month from the current period end (or today).
          if (periodEnd < new Date()) periodEnd.setTime(Date.now());
          periodEnd.setMonth(periodEnd.getMonth() + 1);

          const { error: subscriptionError } = await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
              current_period_end: periodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.subscription_id);

          if (subscriptionError) {
            console.error("Failed to update subscription", subscriptionError);
            return new Response("Failed to update subscription", { status: 500 });
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
