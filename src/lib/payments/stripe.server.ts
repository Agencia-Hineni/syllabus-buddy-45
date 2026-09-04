import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentsNotConfiguredError,
  type CardProvider,
  type CheckoutSession,
  type CheckoutSessionInput,
  type ParsedWebhookEvent,
} from "./types";

/**
 * Adaptador de cartão recorrente via Stripe Checkout (assinatura mensal com
 * preço inline — não exige criar um Price fixo no dashboard da Stripe).
 * https://stripe.com/docs/api/checkout/sessions
 *
 * Requer STRIPE_SECRET_KEY (chamadas à API) e STRIPE_WEBHOOK_SECRET
 * (verificação de assinatura do webhook). Sem essas variáveis, o adaptador
 * recusa operar.
 */

function requiredEnv(): { secretKey: string } | null {
  const secretKey = process.env["STRIPE_SECRET_KEY"];
  if (!secretKey) return null;
  return { secretKey };
}

async function stripeRequest<T>(
  path: string,
  body: URLSearchParams,
  secretKey: string,
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const json = (await res.json()) as T;
  if (!res.ok) throw new Error(`Stripe ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export const stripeCardProvider: CardProvider = {
  name: "stripe",

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const env = requiredEnv();
    if (!env) throw new PaymentsNotConfiguredError("stripe", ["STRIPE_SECRET_KEY"]);

    const body = new URLSearchParams();
    body.set("mode", "subscription");
    body.set("success_url", input.successUrl);
    body.set("cancel_url", input.cancelUrl);
    body.set("customer_email", input.customerEmail);
    body.set("client_reference_id", input.paymentId);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price_data][currency]", "brl");
    body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    body.set("line_items[0][price_data][recurring][interval]", "month");
    body.set("line_items[0][price_data][product_data][name]", "Mensalidade Agenda Acadêmica");

    const session = await stripeRequest<{ id: string; url: string }>(
      "checkout/sessions",
      body,
      env.secretKey,
    );
    return { providerChargeId: session.id, checkoutUrl: session.url };
  },

  async verifyWebhookSignature(request: Request, rawBody: string): Promise<boolean> {
    const secret = process.env["STRIPE_WEBHOOK_SECRET"];
    if (!secret) return false;
    const header = request.headers.get("stripe-signature");
    if (!header) return false;

    const parts = Object.fromEntries(
      header.split(",").map((kv) => {
        const [key, value] = kv.split("=");
        return [key, value] as [string, string];
      }),
    );
    const timestamp = parts["t"];
    const signature = parts["v1"];
    if (!timestamp || !signature) return false;

    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    return timingSafeEqualHex(expected, signature);
  },

  parseWebhookEvent(payload: unknown): ParsedWebhookEvent | null {
    if (!payload || typeof payload !== "object") return null;
    const event = payload as {
      id?: string;
      type?: string;
      data?: { object?: { client_reference_id?: string | null; id?: string } };
    };
    if (!event.id || !event.type) return null;
    const providerChargeId =
      event.data?.object?.client_reference_id ?? event.data?.object?.id ?? null;
    return { eventId: event.id, eventType: event.type, providerChargeId };
  },
};
