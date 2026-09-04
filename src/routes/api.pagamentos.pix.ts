import { createFileRoute } from "@tanstack/react-router";
import { PaymentsNotConfiguredError } from "@/lib/payments/types";

/**
 * Gera (ou reaproveita) a cobrança Pix do mês corrente para o usuário
 * autenticado, na turma em que ele está ativo. Cria a assinatura (trial)
 * na primeira chamada, se ainda não existir.
 *
 * O txid enviado à Efí é o próprio id do pagamento sem hífens — assim o
 * webhook consegue voltar de `provider_charge_id` até a linha em `payments`
 * sem precisar de nenhuma tabela extra de mapeamento.
 */
export const Route = createFileRoute("/api/pagamentos/pix")({
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
        if (!classRes.data) {
          return new Response("Turma não encontrada.", { status: 404 });
        }
        if (classRes.data.monthly_price_cents <= 0) {
          return new Response("Esta turma é gratuita — não há cobrança a gerar.", { status: 400 });
        }
        const amountCents = classRes.data.monthly_price_cents;

        const { pixProvider } = await import("@/lib/payments/index.server");

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
                provider: pixProvider.name,
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

          const existingPayment = await supabaseAdmin
            .from("payments")
            .select("id, status, pix_qr_code, pix_copia_e_cola, expires_at")
            .eq("user_id", uid)
            .eq("class_id", classId)
            .eq("reference_month", referenceMonth)
            .eq("method", "pix")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const reusable =
            existingPayment.data &&
            existingPayment.data.status === "pending" &&
            existingPayment.data.pix_copia_e_cola &&
            existingPayment.data.expires_at &&
            new Date(existingPayment.data.expires_at) > now;

          if (reusable && existingPayment.data) {
            return Response.json({
              qrCodeImageBase64: existingPayment.data.pix_qr_code,
              copyPaste: existingPayment.data.pix_copia_e_cola,
              expiresAt: existingPayment.data.expires_at,
            });
          }

          let paymentId = existingPayment.data?.id;
          if (!paymentId) {
            const inserted = await supabaseAdmin
              .from("payments")
              .insert({
                user_id: uid,
                class_id: classId,
                subscription_id: subscriptionId,
                provider: pixProvider.name,
                method: "pix",
                status: "pending",
                amount_cents: amountCents,
                reference_month: referenceMonth,
              })
              .select("id")
              .single();
            if (inserted.error) throw new Error(inserted.error.message);
            paymentId = inserted.data.id;
          }

          const txid = paymentId.replace(/-/g, "");

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", uid)
            .maybeSingle();

          const charge = await pixProvider.createPixCharge({
            paymentId: txid,
            amountCents,
            payerName: profile?.full_name ?? "Aluno",
            expiresInSeconds: 86_400,
          });

          await supabaseAdmin
            .from("payments")
            .update({
              provider_charge_id: charge.providerChargeId,
              pix_qr_code: charge.qrCodeImageBase64,
              pix_copia_e_cola: charge.copyPaste,
              expires_at: charge.expiresAt,
            })
            .eq("id", paymentId);

          return Response.json({
            qrCodeImageBase64: charge.qrCodeImageBase64,
            copyPaste: charge.copyPaste,
            expiresAt: charge.expiresAt,
          });
        } catch (err) {
          if (err instanceof PaymentsNotConfiguredError) {
            return new Response(err.message, { status: 503 });
          }
          console.error("[pagamentos/pix]", err);
          return new Response("Não foi possível gerar a cobrança Pix.", { status: 500 });
        }
      },
    },
  },
});
