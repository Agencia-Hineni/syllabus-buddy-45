import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqualStr } from "@/lib/security.server";

export const Route = createFileRoute("/api/cron/assinaturas")({
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

        const { runBillingCheck } = await import("@/lib/notifications/billing.server");
        const result = await runBillingCheck();

        return Response.json({ ok: true, ...result });
      },
    },
  },
});
