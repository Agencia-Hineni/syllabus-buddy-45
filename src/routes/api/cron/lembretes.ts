import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqualStr } from "@/lib/security.server";

export const Route = createFileRoute("/api/cron/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return new Response("Cron not configured", { status: 500 });
        }

        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!provided || !timingSafeEqualStr(provided, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { runDueDateReminders, runWeeklyDigest } =
          await import("@/lib/notifications/reminders.server");

        const [dueDate, weeklyDigest] = await Promise.all([
          runDueDateReminders(),
          runWeeklyDigest(),
        ]);

        return Response.json({ ok: true, dueDate, weeklyDigest });
      },
    },
  },
});
