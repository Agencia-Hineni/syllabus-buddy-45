import type { PaymentProvider, PixCharge, WebhookPayload } from "./types";
import { PaymentProviderError } from "./types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new PaymentProviderError(`Missing ${name}`, "missing_credentials");
  return value;
}

/**
 * Efí / Gerencianet provider for Brazilian Pix.
 *
 * This provider reads credentials from environment variables. It is intentionally
 * a thin abstraction: the real Efí OAuth2 + mTLS flow happens behind the scenes.
 * To make it production-ready, replace the stub methods below with authenticated
 * calls to Efí's API using client_id, client_secret and the TLS certificate.
 */
export const efiProvider: PaymentProvider = {
  name: "efi",

  async createPixCharge({ userId, classId, subscriptionId, amountCents, description }) {
    // Credentials are validated eagerly so the error surfaces before any network call.
    requireEnv("EFI_CLIENT_ID");
    requireEnv("EFI_CLIENT_SECRET");
    requireEnv("EFI_CERTIFICATE_BASE64");

    // Stub: replace with Efí POST /v2/cob e then GET /v2/cob/{txid}/qrCode
    const txid = `EFI${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    return {
      txid,
      qrCode: null,
      copiaCola: `00020101021226870014BR.GOV.BCB.PIX2567${txid}5204000053039865405${String(amountCents).padStart(2, "0")}5802BR5913Agenda Academica6008SAOPAULO62070503***6304E2CA`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  parseWebhook(body, secret, headers) {
    const provided = headers.get("x-webhook-secret") ?? "";
    if (!secret || provided !== secret) {
      throw new PaymentProviderError("Invalid webhook signature", "invalid_signature");
    }

    const raw = typeof body === "string" ? JSON.parse(body) : body;
    if (!raw || typeof raw !== "object") return null;

    const record = raw as Record<string, unknown>;
    const eventId = String(record["id"] ?? Date.now());
    const providerChargeId = String(record["txid"] ?? "");
    const statusMap: Record<string, WebhookPayload["status"]> = {
      RECEBIDO: "paid",
      ATRASADO: "expired",
      CANCELADO: "canceled",
      DEVOLVIDO: "refunded",
      EM_ABERTO: "pending",
    };

    const status = statusMap[String(record["status"] ?? "EM_ABERTO")] ?? "pending";
    const amountCents = Math.round(Number(record["valor"] ?? 0) * 100);
    const paidAt: string | undefined = status === "paid" ? new Date().toISOString() : undefined;

    return {
      eventId,
      status,
      providerChargeId,
      amountCents,
      paidAt,
      raw: record,
    };
  },
};
