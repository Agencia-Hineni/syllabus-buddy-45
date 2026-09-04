export type PixChargeInput = {
  paymentId: string;
  amountCents: number;
  payerName: string;
  payerCpf?: string | null;
  expiresInSeconds?: number;
};

export type PixCharge = {
  providerChargeId: string;
  qrCodeImageBase64: string;
  copyPaste: string;
  expiresAt: string;
};

export type ChargeStatus = "pending" | "paid" | "expired" | "failed" | "canceled";

export type ParsedWebhookEvent = {
  eventId: string;
  eventType: string;
  providerChargeId: string | null;
};

/**
 * Porta de pagamentos: todo acesso a um provedor específico (Efí, Stripe, etc.)
 * passa por esta interface. Nenhum outro módulo do app deve importar um SDK de
 * provedor diretamente — trocar de provedor é trocar a implementação aqui.
 */
export interface PaymentsProvider {
  readonly name: string;
  createPixCharge(input: PixChargeInput): Promise<PixCharge>;
  fetchChargeStatus(providerChargeId: string): Promise<ChargeStatus>;
  verifyWebhookSignature(request: Request, rawBody: string): Promise<boolean>;
  parseWebhookEvent(payload: unknown): ParsedWebhookEvent | null;
}

export type CheckoutSessionInput = {
  paymentId: string;
  amountCents: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = {
  providerChargeId: string;
  checkoutUrl: string;
};

/**
 * Porta de cartão recorrente. Separada de `PaymentsProvider` porque cartão
 * funciona por assinatura/checkout hospedado, não por cobrança única como o
 * Pix — mas segue o mesmo princípio de isolamento.
 */
export interface CardProvider {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  verifyWebhookSignature(request: Request, rawBody: string): Promise<boolean>;
  parseWebhookEvent(payload: unknown): ParsedWebhookEvent | null;
}

export class PaymentsNotConfiguredError extends Error {
  constructor(provider: string, missing: string[]) {
    super(`Provedor de pagamentos "${provider}" não configurado. Faltam: ${missing.join(", ")}.`);
    this.name = "PaymentsNotConfiguredError";
  }
}
