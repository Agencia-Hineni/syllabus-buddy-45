import { createFileRoute } from "@tanstack/react-router";
import { PaymentsNotConfiguredError } from "@/lib/payments/types";

/**
 * Cria uma sessão de checkout Stripe (assinatura mensal recorrente) para o
 * usuário autenticado, na turma em que ele está ativo, e devolve a URL de
 * checkout hospedada pela própria Stripe — o app nunca lida com dados de
 * cartão diretamente.
 */
export const Route = createFileRoute("/api/pagamentos/cartao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const uid = userData.user.id;

        const membershipRes = await supabaseAdmin
          .from("class_members")
          .select("class_id")
          .eq("user_id", uid)
          .eq("status", "ativo")
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (membershipRes.error || !membershipRes.data) {
          return new Response("Você não está em nenhuma turma ativa.", { status: 400 });
        }
        const classId = membershipRes.data.class_id;

        const classRes = await supabaseAdmin
          .from("classes")
          .select("monthly_price_cents, grace_days")
          .eq("id", classId)
          .maybeSingle();
        if (!classRes.data || classRes.data.monthly_price_cents <= 0) {
          return new Response("Esta turma é gratuita — não há cobrança a gerar.", { status: 400 });
        }
        const amountCents = classRes.data.monthly_price_cents;

        const { cardProvider } = await import("@/lib/payments/index.server");

        try {
          const subRes = await supabaseAdmin
            .from("subscriptions")
            .select("id")
            .eq("user_id", uid)
            .eq("class_id", classId)
            .maybeSingle();

          let subscriptionId = subRes.data?.id;
          if (!subscriptionId) {
            const created = await supabaseAdmin
              .from("subscriptions")
              .insert({
                user_id: uid,
                class_id: classId,
                status: "trial",
                amount_cents: amountCents,
                grace_days: classRes.data.grace_days,
                provider: cardProvider.name,
              })
              .select("id")
              .single();
            if (created.error) throw new Error(created.error.message);
            subscriptionId = created.data.id;
          }

          const now = new Date();
          const referenceMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
            .toISOString()
            .slice(0, 10);

          const payment = await supabaseAdmin
            .from("payments")
            .insert({
              user_id: uid,
              class_id: classId,
              subscription_id: subscriptionId,
              provider: cardProvider.name,
              method: "card",
              status: "pending",
              amount_cents: amountCents,
              reference_month: referenceMonth,
            })
            .select("id")
            .single();
          if (payment.error) throw new Error(payment.error.message);

          const origin = new URL(request.url).origin;
          const session = await cardProvider.createCheckoutSession({
            paymentId: payment.data.id,
            amountCents,
            customerEmail: userData.user.email ?? "",
            successUrl: `${origin}/assinatura?pagamento=sucesso`,
            cancelUrl: `${origin}/assinatura?pagamento=cancelado`,
          });

          await supabaseAdmin
            .from("payments")
            .update({ provider_charge_id: session.providerChargeId })
            .eq("id", payment.data.id);

          return Response.json({ checkoutUrl: session.checkoutUrl });
        } catch (err) {
          if (err instanceof PaymentsNotConfiguredError) {
            return new Response(err.message, { status: 503 });
          }
          console.error("[pagamentos/cartao]", err);
          return new Response("Não foi possível iniciar o checkout.", { status: 500 });
        }
      },
    },
  },
});
