import { createFileRoute } from "@tanstack/react-router";

/**
 * Disparo dos lembretes por e-mail. Feito para ser chamado por um agendador
 * externo (cron job do provedor de hospedagem, GitHub Actions, ou pg_cron
 * batendo em HTTP) — não há agendador embutido neste servidor.
 *
 * Protegido por segredo compartilhado (header `x-cron-secret` ou
 * `?secret=`), configurado em CRON_SECRET. Sem essa variável configurada,
 * o endpoint recusa toda chamada.
 *
 * Uso:
 *   POST /api/cron/lembretes                 → lembretes de prazo (7/3/1 dia)
 *   POST /api/cron/lembretes?job=weekly-digest → resumo semanal
 */
export const Route = createFileRoute("/api/cron/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return new Response("Cron não configurado (defina CRON_SECRET)", { status: 501 });
        }
        const url = new URL(request.url);
        const provided = request.headers.get("x-cron-secret") ?? url.searchParams.get("secret");
        if (provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { runDueDateReminders, runWeeklyDigest } =
          await import("@/lib/notifications/reminders.server");

        try {
          const job = url.searchParams.get("job");
          const result =
            job === "weekly-digest" ? await runWeeklyDigest() : await runDueDateReminders();
          return Response.json({ job: job ?? "due-date-reminders", ...result });
        } catch (err) {
          console.error("[cron lembretes]", err);
          return new Response("Internal Error", { status: 500 });
        }
      },
    },
  },
});
