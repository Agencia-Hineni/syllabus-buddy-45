import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqualStr } from "@/lib/security.server";

/**
 * Verificação diária de inadimplência: assinaturas vencidas entram em
 * carência e, depois, são bloqueadas — ver src/lib/notifications/billing.server.ts.
 * Protegido pelo mesmo segredo compartilhado usado em /api/cron/lembretes,
 * aceito só via header `x-cron-secret` (nunca via query string).
 */
export const Route = createFileRoute("/api/cron/assinaturas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return new Response("Cron não configurado (defina CRON_SECRET)", { status: 501 });
        }
        const provided = request.headers.get("x-cron-secret");
        if (!provided || !timingSafeEqualStr(provided, secret)) {
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
