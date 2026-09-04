import { MailerNotConfiguredError, type EmailInput, type Mailer } from "./types";

/**
 * Adaptador de e-mail via Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Requer RESEND_API_KEY e RESEND_FROM (ex: "Agenda Acadêmica <avisos@seudominio.com>"),
 * com o domínio de envio verificado no painel da Resend.
 */
export const resendMailer: Mailer = {
  name: "resend",

  async send(input: EmailInput): Promise<void> {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM"];
    if (!apiKey || !from) {
      throw new MailerNotConfiguredError(
        [!apiKey ? "RESEND_API_KEY" : null, !from ? "RESEND_FROM" : null].filter((v): v is string =>
          Boolean(v),
        ),
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondeu ${res.status}: ${body}`);
    }
  },
};
