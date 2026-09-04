import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mailer } from "@/lib/mailer/index.server";
import { MailerNotConfiguredError } from "@/lib/mailer/types";
import type { Database } from "@/integrations/supabase/types";

type NotificationKind = Database["public"]["Enums"]["notification_kind"];

export type SendResult = "sent" | "duplicate" | "skipped";

/**
 * Checks notification_log for `dedupe_key` first (unique per user), sends the
 * email only if it hasn't gone out yet, then logs it. If RESEND_API_KEY isn't
 * configured, mailer.send() throws MailerNotConfiguredError, nothing is
 * logged, and the same notification can still go out once it is configured.
 */
export async function sendAndLog(input: {
  userId: string;
  kind: NotificationKind;
  dedupeKey: string;
  to: string;
  subject: string;
  html: string;
  assignmentId?: string;
}): Promise<SendResult> {
  const { data: existing } = await supabaseAdmin
    .from("notification_log")
    .select("id")
    .eq("user_id", input.userId)
    .eq("dedupe_key", input.dedupeKey)
    .maybeSingle();
  if (existing) return "duplicate";

  try {
    await mailer.send({ to: input.to, subject: input.subject, html: input.html });
  } catch (err) {
    if (err instanceof MailerNotConfiguredError) {
      console.warn(
        `[notifications] mailer not configured, skipping "${input.kind}" to ${input.to}`,
      );
    } else {
      console.error(`[notifications] failed to send "${input.kind}"`, err);
    }
    return "skipped";
  }

  const { error } = await supabaseAdmin.from("notification_log").insert({
    user_id: input.userId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    assignment_id: input.assignmentId ?? null,
  });
  if (error && error.code !== "23505") {
    console.error("[notifications] failed to log sent notification", error);
  }
  return "sent";
}
