import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mailer } from "@/lib/mailer/index.server";
import { formatDate, formatMoney } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { billingBlockedEmail, billingDueEmail } from "./templates.server";

type NotificationKind = Database["public"]["Enums"]["notification_kind"];
type JobResult = { movedToGrace: number; blocked: number; skipped: number };

async function claimDedupeSlot(
  userId: string,
  kind: NotificationKind,
  dedupeKey: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("notification_log")
    .insert({ user_id: userId, kind, channel: "email", dedupe_key: dedupeKey });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

/**
 * Verifica assinaturas vencidas e aplica a regra de carência + bloqueio:
 *   - dentro da carência (current_period_end < agora <= current_period_end + grace_days)
 *     → status vira "grace_period" e um aviso é enviado (uma vez por vencimento).
 *   - fora da carência (agora > current_period_end + grace_days)
 *     → status vira "blocked", blocked_at é registrado e um aviso é enviado.
 *
 * O desbloqueio automático ao pagar já acontece em settlePayment() no webhook
 * de pagamentos — este job só cuida do sentido contrário (ficar em dia → vencer).
 *
 * Pensado para rodar diariamente via o mesmo agendador externo que chama
 * /api/cron/lembretes — ver /api/cron/assinaturas.
 */
export async function runBillingCheck(): Promise<JobResult> {
  const result: JobResult = { movedToGrace: 0, blocked: 0, skipped: 0 };
  const now = new Date();

  const { data: subscriptions, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, user_id, class_id, status, amount_cents, current_period_end, grace_days")
    .in("status", ["active", "grace_period"])
    .not("current_period_end", "is", null);
  if (error) throw new Error(error.message);

  for (const sub of subscriptions ?? []) {
    const periodEnd = new Date(sub.current_period_end!);
    if (periodEnd > now) {
      result.skipped++;
      continue; // ainda dentro do período pago
    }

    const graceEnd = new Date(periodEnd.getTime() + sub.grace_days * 86_400_000);
    const shouldBlock = now > graceEnd;
    const dedupeKey = `${shouldBlock ? "billing_blocked" : "billing_due"}:${sub.id}:${periodEnd.toISOString().slice(0, 10)}`;

    if (shouldBlock && sub.status !== "blocked") {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "blocked", blocked_at: now.toISOString() })
        .eq("id", sub.id);
      result.blocked++;
      await notify(sub.user_id, "billing_blocked", dedupeKey, async (profile) => {
        const { subject, html } = billingBlockedEmail({
          studentName: profile.full_name ?? "aluno",
        });
        return { to: profile.email!, subject, html };
      });
    } else if (!shouldBlock && sub.status !== "grace_period") {
      await supabaseAdmin.from("subscriptions").update({ status: "grace_period" }).eq("id", sub.id);
      result.movedToGrace++;
      await notify(sub.user_id, "billing_due", dedupeKey, async (profile) => {
        const { subject, html } = billingDueEmail({
          studentName: profile.full_name ?? "aluno",
          amountFormatted: formatMoney(sub.amount_cents),
          dueAtFormatted: formatDate(sub.current_period_end!),
          graceDays: sub.grace_days,
        });
        return { to: profile.email!, subject, html };
      });
    } else {
      result.skipped++;
    }
  }

  return result;
}

async function notify(
  userId: string,
  kind: NotificationKind,
  dedupeKey: string,
  build: (profile: {
    full_name: string | null;
    email: string | null;
  }) => Promise<{ to: string; subject: string; html: string }>,
): Promise<void> {
  let claimed: boolean;
  try {
    claimed = await claimDedupeSlot(userId, kind, dedupeKey);
  } catch {
    return;
  }
  if (!claimed) return;

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email) return;
    const { to, subject, html } = await build(profile);
    await mailer.send({ to, subject, html });
  } catch (err) {
    console.error("[billing] falha ao enviar aviso de cobrança", err);
    await supabaseAdmin
      .from("notification_log")
      .update({ error: err instanceof Error ? err.message : String(err) })
      .eq("user_id", userId)
      .eq("dedupe_key", dedupeKey);
  }
}
