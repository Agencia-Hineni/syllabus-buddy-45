import { addDays } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { billingBlockedEmail, billingDueEmail } from "./templates.server";
import { sendAndLog, type SendResult } from "./send.server";

function tally(counts: Record<SendResult, number>, result: SendResult) {
  counts[result] += 1;
}

/**
 * Moves subscriptions past their due date into grace_period, then into
 * blocked once grace_days have elapsed. Each transition is guarded by an
 * `.eq("status", <expected>)` on the update so a concurrent run (or a
 * payment landing via the webhook mid-check) can't double-apply it.
 */
export async function runBillingCheck(): Promise<{
  movedToGrace: number;
  blocked: number;
  notifications: Record<SendResult, number>;
}> {
  const now = new Date();
  const notifications: Record<SendResult, number> = { sent: 0, duplicate: 0, skipped: 0 };
  let movedToGrace = 0;
  let blocked = 0;

  const { data: dueSubs, error: dueError } = await supabaseAdmin
    .from("subscriptions")
    .select(
      "id, user_id, class_id, status, amount_cents, current_period_end, grace_days, classes(name)",
    )
    .in("status", ["trial", "active"])
    .lt("current_period_end", now.toISOString());

  if (dueError) console.error("[billing] failed to fetch due subscriptions", dueError);

  for (const sub of dueSubs ?? []) {
    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "grace_period" })
      .eq("id", sub.id)
      .eq("status", sub.status);
    if (updateError) {
      console.error("[billing] failed to move subscription to grace_period", updateError);
      continue;
    }
    movedToGrace++;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", sub.user_id)
      .maybeSingle();
    if (!profile?.email) {
      tally(notifications, "skipped");
      continue;
    }

    const { subject, html } = billingDueEmail({
      studentName: profile.full_name ?? "aluno",
      className: sub.classes?.name ?? "sua turma",
      amountCents: sub.amount_cents,
      graceDays: sub.grace_days,
    });

    const result = await sendAndLog({
      userId: sub.user_id,
      kind: "billing_due",
      dedupeKey: `billing_due:${sub.id}:${sub.current_period_end}`,
      to: profile.email,
      subject,
      html,
    });
    tally(notifications, result);
  }

  const { data: graceSubs, error: graceError } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, class_id, amount_cents, current_period_end, grace_days, classes(name)")
    .eq("status", "grace_period")
    .is("blocked_at", null);

  if (graceError) console.error("[billing] failed to fetch grace-period subscriptions", graceError);

  for (const sub of graceSubs ?? []) {
    if (!sub.current_period_end) continue;
    const graceDeadline = addDays(new Date(sub.current_period_end), sub.grace_days);
    if (graceDeadline >= now) continue;

    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "blocked", blocked_at: now.toISOString() })
      .eq("id", sub.id)
      .eq("status", "grace_period");
    if (updateError) {
      console.error("[billing] failed to block subscription", updateError);
      continue;
    }
    blocked++;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", sub.user_id)
      .maybeSingle();
    if (!profile?.email) {
      tally(notifications, "skipped");
      continue;
    }

    const { subject, html } = billingBlockedEmail({
      studentName: profile.full_name ?? "aluno",
      className: sub.classes?.name ?? "sua turma",
      amountCents: sub.amount_cents,
    });

    const result = await sendAndLog({
      userId: sub.user_id,
      kind: "billing_blocked",
      dedupeKey: `billing_blocked:${sub.id}:${sub.current_period_end}`,
      to: profile.email,
      subject,
      html,
    });
    tally(notifications, result);
  }

  return { movedToGrace, blocked, notifications };
}
