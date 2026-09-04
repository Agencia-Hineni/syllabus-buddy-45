import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, CreditCard, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, paymentsQuery, subscriptionQuery } from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura | Agenda Acadêmica" },
      {
        name: "description",
        content: "Situação da sua assinatura, vencimento e histórico de pagamentos.",
      },
      { property: "og:title", content: "Assinatura | Agenda Acadêmica" },
      {
        property: "og:description",
        content: "Situação da sua assinatura, vencimento e histórico de pagamentos.",
      },
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

type PixCharge = { qrCodeImageBase64: string; copyPaste: string; expiresAt: string };

function Assinatura() {
  const queryClient = useQueryClient();
  const { data: membership } = useQuery(membershipQuery());
  const { data: subscription } = useQuery(subscriptionQuery());
  const { data: payments } = useQuery(paymentsQuery());
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);

  const price = membership?.classes?.monthly_price_cents ?? 0;
  const needsPayment = subscription?.status !== "active" && price > 0;

  const generatePix = useMutation({
    mutationFn: async (): Promise<PixCharge> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const res = await fetch("/api/pagamentos/pix", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          res.status === 503
            ? "Pagamento por Pix ainda não foi configurado pela administração. Tente novamente mais tarde."
            : text || "Não foi possível gerar a cobrança Pix.",
        );
      }
      return res.json();
    },
    onSuccess: (charge) => {
      setPixCharge(charge);
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startCardCheckout = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const res = await fetch("/api/pagamentos/cartao", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          res.status === 503
            ? "Pagamento por cartão ainda não foi configurado pela administração. Tente novamente mais tarde."
            : text || "Não foi possível iniciar o checkout.",
        );
      }
      const { checkoutUrl } = (await res.json()) as { checkoutUrl: string };
      return checkoutUrl;
    },
    onSuccess: (checkoutUrl) => {
      window.location.href = checkoutUrl;
    },
    onError: (e: Error) => toast.error(e.message),
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
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Assim que o pagamento for confirmado, o acesso é renovado automaticamente.</p>
          {needsPayment && !pixCharge && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => generatePix.mutate()} disabled={generatePix.isPending}>
                {generatePix.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 size-4" />
                )}
                Gerar cobrança Pix
              </Button>
              <Button
                variant="outline"
                onClick={() => startCardCheckout.mutate()}
                disabled={startCardCheckout.isPending}
              >
                {startCardCheckout.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 size-4" />
                )}
                Pagar com cartão
              </Button>
            </div>
          )}
          {pixCharge && (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              {pixCharge.qrCodeImageBase64 && (
                <img
                  src={
                    pixCharge.qrCodeImageBase64.startsWith("data:")
                      ? pixCharge.qrCodeImageBase64
                      : `data:image/png;base64,${pixCharge.qrCodeImageBase64}`
                  }
                  alt="QR Code Pix"
                  className="mx-auto h-48 w-48"
                />
              )}
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-2 py-1.5 text-xs">
                  {pixCharge.copyPaste}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copiar código Pix"
                  onClick={() => {
                    navigator.clipboard.writeText(pixCharge.copyPaste);
                    toast.success("Código copiado");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <p className="text-xs">
                Válido até {formatDate(pixCharge.expiresAt)}. O acesso libera automaticamente após a
                confirmação.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-lg">Histórico de pagamentos</h2>
        {!payments || payments.length === 0 ? (
          <EmptyState
            title="Nenhum pagamento ainda"
            description="Seus pagamentos aparecerão aqui."
          />
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm"
              >
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
