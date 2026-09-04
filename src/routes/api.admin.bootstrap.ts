import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqualStr } from "@/lib/security.server";

/**
 * Concede o papel global "admin" ao usuário autenticado que fizer a
 * chamada — usado uma única vez para criar o primeiro administrador da
 * plataforma, já que por design (RLS) ninguém pode se auto-promover via
 * INSERT direto em `user_roles`.
 *
 * De uso único por construção: se já existir qualquer admin, o endpoint
 * se recusa a promover mais alguém (mesmo com o segredo correto) — depois
 * de criado o primeiro admin, novos administradores são promovidos pelo
 * próprio painel Admin, não por aqui.
 *
 * Protegido por ADMIN_BOOTSTRAP_SECRET (defina, use uma vez, depois pode
 * remover a variável — o primeiro admin promovido continua admin).
 */
export const Route = createFileRoute("/api/admin/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const configuredSecret = process.env["ADMIN_BOOTSTRAP_SECRET"];
        if (!configuredSecret) {
          return new Response("Bootstrap não configurado (defina ADMIN_BOOTSTRAP_SECRET)", {
            status: 501,
          });
        }

        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized: token ausente", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);

        const body = await request.json().catch(() => null);
        const providedSecret =
          body && typeof body === "object" ? (body as { secret?: unknown }).secret : null;
        if (
          typeof providedSecret !== "string" ||
          !timingSafeEqualStr(providedSecret, configuredSecret)
        ) {
          return new Response("Unauthorized: segredo inválido", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const existingAdmin = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("role", "admin")
          .limit(1);
        if (existingAdmin.error) {
          console.error("[admin bootstrap]", existingAdmin.error);
          return new Response("Internal Error", { status: 500 });
        }
        if (existingAdmin.data.length > 0) {
          return new Response(
            "Já existe um administrador nesta plataforma. Peça para um admin existente te promover pelo painel Admin.",
            { status: 403 },
          );
        }

        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !userData.user) {
          return new Response("Unauthorized: sessão inválida", { status: 401 });
        }

        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userData.user.id, role: "admin" }, { onConflict: "user_id,role" });
        if (error) {
          console.error("[admin bootstrap]", error);
          return new Response("Internal Error", { status: 500 });
        }

        return Response.json({ ok: true, userId: userData.user.id });
      },
    },
  },
});
