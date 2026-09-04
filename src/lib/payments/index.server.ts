import { efiPixProvider } from "./efi.server";
import type { PaymentsProvider } from "./types";

export * from "./types";

/**
 * Ponto único de acesso a pagamentos. Nenhum outro módulo deve importar um
 * adaptador de provedor diretamente — isso mantém o Stripe/Efí isolados
 * atrás desta porta, como pede a arquitetura do projeto.
 */
export const pixProvider: PaymentsProvider = efiPixProvider;
