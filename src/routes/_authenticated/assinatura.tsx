import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Copy, QrCode } from "lucide-react";
import { membershipQuery, paymentsQuery, subscriptionQuery } from "@/lib/queries";
import { generatePixCharge } from "@/lib/payments/pix.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura | Agenda Acadêmica" },
      { name: "description", content: "Situação da sua assinatura, vencimento e histórico de pagamentos." },
      { property: "og:title", content: "Assinatura | Agenda Acadêmica" },
      { property: "og:description", content: "Situação da sua assinatura, vencimento e histórico de pagamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Assinatura,
});

const statusLabel: Record<string, string> = {
  trial: "Período de teste",
  active: "Ativa",
  grace_period: "Em carência",
  blocked: "Bloqueada",
  canceled: "Cancelada",
};

function Assinatura() {
  const { data: membership } = useQuery(membershipQuery());
  const { data: subscription } = useQuery(subscriptionQuery());
  const { data: payments } = useQuery(paymentsQuery());
  const queryClient = useQueryClient();
  const createPix = useServerFn(generatePixCharge);
  const [pix, setPix] = useState<{ qrCode: string; copiaCola: string; expiresAt: string } | null>(null);

  const price = membership?.classes?.monthly_price_cents ?? 0;

  const pixMutation = useMutation({
    mutationFn: async () => {
      if (!subscription?.id) throw new Error("Sua assinatura ainda não foi criada.");
      return createPix({
        data: {
          subscriptionId: subscription.id,
          amountCents: price,
          description: "Mensalidade da Agenda Acadêmica",
        },
      });
    },
    onSuccess: (charge) => {
      setPix({ qrCode: charge.qrCode, copiaCola: charge.copiaCola, expiresAt: charge.expiresAt });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Cobrança Pix gerada.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Não foi possível gerar a cobrança Pix.");
    },
  });


  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Assinatura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mensalidade da turma: {formatMoney(price)} por aluno
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Situação
            <Badge variant={subscription?.status === "blocked" ? "destructive" : "secondary"}>
              {statusLabel[subscription?.status ?? "trial"]}
            </Badge>
          </CardTitle>
          <CardDescription>
            {subscription?.current_period_end
              ? `Válida até ${formatDate(subscription.current_period_end)}`
              : "Sua assinatura ainda não foi iniciada."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O pagamento por Pix e cartão será liberado em breve. Assim que o pagamento for confirmado, o
          acesso é renovado automaticamente.
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg">Histórico de pagamentos</h2>
        {!payments || payments.length === 0 ? (
          <EmptyState title="Nenhum pagamento ainda" description="Seus pagamentos aparecerão aqui." />
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm">
                <span>{formatDate(p.created_at)}</span>
                <span>{p.method === "pix" ? "Pix" : "Cartão"}</span>
                <span>{formatMoney(p.amount_cents)}</span>
                <Badge variant={p.status === "paid" ? "secondary" : "outline"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
