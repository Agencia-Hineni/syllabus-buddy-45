import { efiPixProvider } from "./efi.server";
import { stripeCardProvider } from "./stripe.server";
import type { CardProvider, PaymentsProvider } from "./types";

export * from "./types";

/**
 * Ponto único de acesso a pagamentos. Nenhum outro módulo deve importar um
 * adaptador de provedor diretamente — isso mantém o Stripe/Efí isolados
 * atrás desta porta, como pede a arquitetura do projeto.
 */
export const pixProvider: PaymentsProvider = efiPixProvider;
export const cardProvider: CardProvider = stripeCardProvider;
