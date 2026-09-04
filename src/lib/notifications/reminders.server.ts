import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mailer } from "@/lib/mailer/index.server";
import { formatDate } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";
import { assignmentReminderEmail, weeklyDigestEmail } from "./templates.server";

const DAY_MS = 86_400_000;
type NotificationKind = Database["public"]["Enums"]["notification_kind"];

type JobResult = { sent: number; skipped: number; failed: number };

async function claimDedupeSlot(
  userId: string,
  kind: NotificationKind,
  assignmentId: string | null,
  dedupeKey: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("notification_log").insert({
    user_id: userId,
    kind,
    channel: "email",
    assignment_id: assignmentId,
    dedupe_key: dedupeKey,
  });
  if (!error) return true;
  if (error.code === "23505") return false; // já enviado antes — idempotência
  throw new Error(error.message);
}

async function markDedupeError(userId: string, dedupeKey: string, err: unknown): Promise<void> {
  await supabaseAdmin
    .from("notification_log")
    .update({ error: err instanceof Error ? err.message : String(err) })
    .eq("user_id", userId)
    .eq("dedupe_key", dedupeKey);
}

/**
 * Lembretes de prazo (7, 3 e 1 dia antes). Pensado para rodar uma vez por dia
 * via cron externo batendo em /api/cron/lembretes — ver aquele arquivo para
 * como proteger o disparo com um segredo compartilhado.
 *
 * Cada combinação (usuário, atividade, janela) só é enviada uma vez, graças
 * à chave única em `notification_log (user_id, dedupe_key)`.
 */
export async function runDueDateReminders(): Promise<JobResult> {
  const result: JobResult = { sent: 0, skipped: 0, failed: 0 };
  const now = new Date();

  for (const offset of [7, 3, 1] as const) {
    const windowStart = new Date(now.getTime() + offset * DAY_MS);
    windowStart.setUTCHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart.getTime() + DAY_MS);
    const prefField =
      offset === 7 ? "remind_7_days" : offset === 3 ? "remind_3_days" : "remind_1_day";

    const { data: assignments, error } = await supabaseAdmin
      .from("assignments")
      .select("id, title, type, due_at, class_id, subjects(name)")
      .gte("due_at", windowStart.toISOString())
      .lt("due_at", windowEnd.toISOString());
    if (error) throw new Error(error.message);

    for (const assignment of assignments ?? []) {
      const { data: members, error: membersError } = await supabaseAdmin
        .from("class_members")
        .select("user_id")
        .eq("class_id", assignment.class_id)
        .eq("status", "ativo");
      if (membersError) throw new Error(membersError.message);

      for (const member of members ?? []) {
        const dedupeKey = `assignment:${assignment.id}:${offset}d`;

        const { data: completion } = await supabaseAdmin
          .from("assignment_completions")
          .select("id")
          .eq("assignment_id", assignment.id)
          .eq("user_id", member.user_id)
          .maybeSingle();
        if (completion) {
          result.skipped++;
          continue;
        }

        const { data: prefs } = await supabaseAdmin
          .from("notification_preferences")
          .select("email_enabled, remind_7_days, remind_3_days, remind_1_day")
          .eq("user_id", member.user_id)
          .maybeSingle();
        if (!prefs?.email_enabled || !prefs[prefField]) {
          result.skipped++;
          continue;
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, email")
          .eq("id", member.user_id)
          .maybeSingle();
        if (!profile?.email) {
          result.skipped++;
          continue;
        }

        const kind: NotificationKind = assignment.type === "prova" ? "exam_due" : "assignment_due";
        const claimed = await claimDedupeSlot(member.user_id, kind, assignment.id, dedupeKey);
        if (!claimed) {
          result.skipped++;
          continue;
        }

        try {
          const { subject, html } = assignmentReminderEmail({
            studentName: profile.full_name ?? "aluno",
            assignmentTitle: assignment.title,
            subjectName: assignment.subjects?.name ?? "Disciplina",
            typeLabel: assignment.type === "prova" ? "Prova" : "Atividade",
            dueAtFormatted: formatDate(assignment.due_at),
            daysUntil: offset,
          });
          await mailer.send({ to: profile.email, subject, html });
          result.sent++;
        } catch (err) {
          result.failed++;
          await markDedupeError(member.user_id, dedupeKey, err);
        }
      }
    }
  }

  return result;
}

/**
 * Resumo semanal — pensado para rodar uma vez por semana (segunda de manhã)
 * via o mesmo cron externo, com `?job=weekly-digest`.
 */
export async function runWeeklyDigest(): Promise<JobResult> {
  const result: JobResult = { sent: 0, skipped: 0, failed: 0 };
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const dedupeKey = `weekly:${weekStart.toISOString().slice(0, 10)}`;

  const { data: members, error } = await supabaseAdmin
    .from("class_members")
    .select("user_id, class_id")
    .eq("status", "ativo");
  if (error) throw new Error(error.message);

  for (const member of members ?? []) {
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("email_enabled, weekly_digest")
      .eq("user_id", member.user_id)
      .maybeSingle();
    if (!prefs?.email_enabled || !prefs.weekly_digest) {
      result.skipped++;
      continue;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", member.user_id)
      .maybeSingle();
    if (!profile?.email) {
      result.skipped++;
      continue;
    }

    const claimed = await claimDedupeSlot(member.user_id, "weekly_digest", null, dedupeKey);
    if (!claimed) {
      result.skipped++;
      continue;
    }

    try {
      const { data: assignments } = await supabaseAdmin
        .from("assignments")
        .select("title, due_at, subjects(name)")
        .eq("class_id", member.class_id)
        .gte("due_at", weekStart.toISOString())
        .lt("due_at", weekEnd.toISOString())
        .order("due_at");

      const { subject, html } = weeklyDigestEmail({
        studentName: profile.full_name ?? "aluno",
        weekLabel: `${formatDate(weekStart.toISOString())} a ${formatDate(new Date(weekEnd.getTime() - DAY_MS).toISOString())}`,
        items: (assignments ?? []).map((a) => ({
          title: a.title,
          subjectName: a.subjects?.name ?? "Disciplina",
          dueAtFormatted: formatDate(a.due_at),
        })),
      });
      await mailer.send({ to: profile.email, subject, html });
      result.sent++;
    } catch (err) {
      result.failed++;
      await markDedupeError(member.user_id, dedupeKey, err);
    }
  }

  return result;
}
