import { resendMailer } from "./resend.server";
import type { Mailer } from "./types";

// Isolated behind the Mailer interface so swapping providers never touches
// call sites. Not configuring RESEND_API_KEY/RESEND_FROM doesn't crash the
// app — mailer.send() just throws MailerNotConfiguredError, which callers
// (reminders/billing/webhook) catch and skip, logging a warning instead.
export const mailer: Mailer = resendMailer;
