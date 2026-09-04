import { efiProvider } from "./efi-provider";
import type { PaymentProvider, PixCharge, WebhookPayload } from "./types";
import { PaymentProviderError } from "./types";

export type ProviderName = "efi" | "stripe";

export function getPaymentService(provider: ProviderName = "efi"): PaymentProvider {
  switch (provider) {
    case "efi":
      return efiProvider;
    default:
      throw new PaymentProviderError(`Unsupported provider: ${provider}`, "unsupported_provider");
  }
}

export async function createPixCharge(...args: Parameters<PaymentProvider["createPixCharge"]>) {
  return getPaymentService("efi").createPixCharge(args[0]);
}

export function parseWebhookPayload(
  provider: ProviderName,
  body: unknown,
  secret: string,
  headers: Headers,
) {
  return getPaymentService(provider).parseWebhook(body, secret, headers);
}

export function fetchChargeStatus(provider: ProviderName, providerChargeId: string) {
  return getPaymentService(provider).fetchChargeStatus(providerChargeId);
}
