import { addDays, getISOWeek, getISOWeekYear, startOfDay } from "date-fns";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AssignmentType } from "@/lib/queries";
import { assignmentReminderEmail, weeklyDigestEmail } from "./templates.server";
import { sendAndLog, type SendResult } from "./send.server";

type PrefField = "remind_7_days" | "remind_3_days" | "remind_1_day";

const REMINDER_WINDOWS: { days: number; prefField: PrefField }[] = [
  { days: 7, prefField: "remind_7_days" },
  { days: 3, prefField: "remind_3_days" },
  { days: 1, prefField: "remind_1_day" },
];

function tally(counts: Record<SendResult, number>, result: SendResult) {
  counts[result] += 1;
}

export async function runDueDateReminders(): Promise<Record<SendResult, number>> {
  const counts: Record<SendResult, number> = { sent: 0, duplicate: 0, skipped: 0 };

  for (const window of REMINDER_WINDOWS) {
    const dayStart = startOfDay(addDays(new Date(), window.days));
    const dayEnd = addDays(dayStart, 1);

    const { data: assignments, error } = await supabaseAdmin
      .from("assignments")
      .select("id, title, type, due_at, class_id, subjects(name)")
      .gte("due_at", dayStart.toISOString())
      .lt("due_at", dayEnd.toISOString());

    if (error) {
      console.error("[reminders] failed to fetch assignments", error);
      continue;
    }

    for (const assignment of assignments ?? []) {
      const { data: members } = await supabaseAdmin
        .from("class_members")
        .select("user_id")
        .eq("class_id", assignment.class_id)
        .eq("status", "ativo");
      const userIds = (members ?? []).map((m) => m.user_id);
      if (userIds.length === 0) continue;

      const [{ data: prefsRows }, { data: profileRows }] = await Promise.all([
        supabaseAdmin
          .from("notification_preferences")
          .select("user_id, email_enabled, remind_7_days, remind_3_days, remind_1_day")
          .in("user_id", userIds),
        supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds),
      ]);

      const kind = assignment.type === "prova" ? "exam_due" : "assignment_due";

      for (const userId of userIds) {
        const prefs = prefsRows?.find((p) => p.user_id === userId);
        if (prefs && (!prefs.email_enabled || !prefs[window.prefField])) {
          tally(counts, "skipped");
          continue;
        }
        const profile = profileRows?.find((p) => p.id === userId);
        if (!profile?.email) {
          tally(counts, "skipped");
          continue;
        }

        const { subject, html } = assignmentReminderEmail({
          studentName: profile.full_name ?? "aluno",
          title: assignment.title,
          type: assignment.type as AssignmentType,
          subjectName: assignment.subjects?.name ?? "Disciplina",
          dueAt: assignment.due_at,
          daysLeft: window.days,
        });

        const result = await sendAndLog({
          userId,
          kind,
          dedupeKey: `${kind}:${assignment.id}:${window.days}d`,
          to: profile.email,
          subject,
          html,
          assignmentId: assignment.id,
        });
        tally(counts, result);
      }
    }
  }

  return counts;
}

export async function runWeeklyDigest(): Promise<Record<SendResult, number>> {
  const counts: Record<SendResult, number> = { sent: 0, duplicate: 0, skipped: 0 };

  const now = new Date();
  const weekEnd = addDays(now, 7);
  const isoWeek = `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;

  const { data: memberships, error } = await supabaseAdmin
    .from("class_members")
    .select("user_id, class_id, classes(name)")
    .eq("status", "ativo");

  if (error) {
    console.error("[weekly-digest] failed to fetch memberships", error);
    return counts;
  }
  if (!memberships?.length) return counts;

  const userIds = memberships.map((m) => m.user_id);
  const [{ data: prefsRows }, { data: profileRows }] = await Promise.all([
    supabaseAdmin
      .from("notification_preferences")
      .select("user_id, email_enabled, weekly_digest")
      .in("user_id", userIds),
    supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds),
  ]);

  for (const membership of memberships) {
    const prefs = prefsRows?.find((p) => p.user_id === membership.user_id);
    if (prefs && (!prefs.email_enabled || !prefs.weekly_digest)) {
      tally(counts, "skipped");
      continue;
    }
    const profile = profileRows?.find((p) => p.id === membership.user_id);
    if (!profile?.email) {
      tally(counts, "skipped");
      continue;
    }

    const { data: assignments } = await supabaseAdmin
      .from("assignments")
      .select("title, type, due_at, subjects(name)")
      .eq("class_id", membership.class_id)
      .gte("due_at", now.toISOString())
      .lt("due_at", weekEnd.toISOString())
      .order("due_at");

    const { subject, html } = weeklyDigestEmail({
      studentName: profile.full_name ?? "aluno",
      className: membership.classes?.name ?? "sua turma",
      items: (assignments ?? []).map((a) => ({
        title: a.title,
        type: a.type as AssignmentType,
        subjectName: a.subjects?.name ?? "Disciplina",
        dueAt: a.due_at,
      })),
    });

    const result = await sendAndLog({
      userId: membership.user_id,
      kind: "weekly_digest",
      dedupeKey: `weekly_digest:${membership.class_id}:${isoWeek}`,
      to: profile.email,
      subject,
      html,
    });
    tally(counts, result);
  }

  return counts;
}
