import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPixCharge } from "./payment-service";
import { PaymentProviderError } from "./types";

export const generatePixCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { subscriptionId: string; amountCents: number; description: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Ensure the subscription belongs to the current user.
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("id, class_id, status")
      .eq("id", data.subscriptionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (subError) throw new Error(subError.message);
    if (!subscription) throw new Error("Subscription not found");

    const charge = await createPixCharge({
      userId,
      classId: subscription.class_id,
      subscriptionId: subscription.id,
      amountCents: data.amountCents,
      description: data.description,
    });

    // Writes to payments are server-only (no client INSERT policy).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      class_id: subscription.class_id,
      subscription_id: subscription.id,
      provider: "efi",
      method: "pix",
      provider_charge_id: charge.txid,
      amount_cents: data.amountCents,
      status: "pending",
      pix_qr_code: charge.qrCode,
      pix_copia_e_cola: charge.copiaCola,
      expires_at: charge.expiresAt,
    });

    if (paymentError) throw new Error(paymentError.message);
    return charge;
  });
