export interface PixCharge {
  txid: string;
  qrCode: string | null;
  copiaCola: string | null;
  expiresAt: string;
  raw?: unknown;
}

export interface WebhookPayload {
  eventId: string;
  status: "pending" | "paid" | "cancelled" | "expired" | "refunded";
  providerChargeId: string;
  amountCents: number;
  paidAt?: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createPixCharge(input: {
    userId: string;
    classId: string;
    subscriptionId: string;
    amountCents: number;
    description: string;
  }): Promise<PixCharge>;
  parseWebhook(body: unknown, secret: string, headers: Headers): Promise<WebhookPayload> | WebhookPayload | null;
}

export class PaymentProviderError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
