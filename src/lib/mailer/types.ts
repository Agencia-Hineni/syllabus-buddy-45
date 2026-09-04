export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface Mailer {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class MailerNotConfiguredError extends Error {
  constructor() {
    super("Mailer not configured: missing RESEND_API_KEY/RESEND_FROM");
    this.name = "MailerNotConfiguredError";
  }
}
