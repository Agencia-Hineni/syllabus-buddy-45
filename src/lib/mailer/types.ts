export type EmailInput = {
  to: string;
  subject: string;
  html: string;
};

export interface Mailer {
  readonly name: string;
  send(input: EmailInput): Promise<void>;
}

export class MailerNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`Envio de e-mail não configurado. Faltam: ${missing.join(", ")}.`);
    this.name = "MailerNotConfiguredError";
  }
}
