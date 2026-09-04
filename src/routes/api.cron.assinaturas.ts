import { createFileRoute } from "@tanstack/react-router";

/**
 * Verificação diária de inadimplência: assinaturas vencidas entram em
 * carência e, depois, são bloqueadas — ver src/lib/notifications/billing.server.ts.
 * Protegido pelo mesmo segredo compartilhado usado em /api/cron/lembretes.
 */
export const Route = createFileRoute("/api/cron/assinaturas")({
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

        try {
          const { runBillingCheck } = await import("@/lib/notifications/billing.server");
          const result = await runBillingCheck();
          return Response.json(result);
        } catch (err) {
          console.error("[cron assinaturas]", err);
          return new Response("Internal Error", { status: 500 });
        }
      },
    },
  },
});
