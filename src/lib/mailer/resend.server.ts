import type { EmailMessage, Mailer } from "./types";
import { MailerNotConfiguredError } from "./types";

export const resendMailer: Mailer = {
  name: "resend",

  async send({ to, subject, html }: EmailMessage) {
    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["RESEND_FROM"];

    if (!apiKey || !from) {
      throw new MailerNotConfiguredError();
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }
  },
};
