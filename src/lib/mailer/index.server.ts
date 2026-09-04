import { resendMailer } from "./resend.server";
import type { Mailer } from "./types";

export * from "./types";

/**
 * Ponto único de acesso a e-mail transacional. Trocar de provedor é trocar
 * a implementação aqui — nada mais no app deve importar um SDK de e-mail.
 */
export const mailer: Mailer = resendMailer;
