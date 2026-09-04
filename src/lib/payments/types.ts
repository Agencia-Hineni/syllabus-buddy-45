export interface PixCharge {
  txid: string;
  qrCode: string | null;
  copiaCola: string | null;
  expiresAt: string;
}

export interface WebhookPayload {
  eventId: string;
  status: "pending" | "paid" | "canceled" | "expired" | "refunded";
  providerChargeId: string;
  amountCents: number;
  paidAt?: string | undefined;
  raw: Record<string, unknown> | null;
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
  parseWebhook(
    body: unknown,
    secret: string,
    headers: Headers,
  ): Promise<WebhookPayload> | WebhookPayload | null;
  /**
   * Reconsulta a cobrança diretamente na API do provedor. O status vindo do
   * corpo do webhook nunca deve ser aplicado sozinho — ele só diz "algo
   * mudou, vá conferir"; esta chamada é a fonte da verdade antes de liberar
   * o acesso do aluno.
   */
  fetchChargeStatus(providerChargeId: string): Promise<WebhookPayload["status"]>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
