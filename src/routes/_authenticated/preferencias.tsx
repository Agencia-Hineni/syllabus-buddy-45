import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  notificationPreferencesQuery,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/preferencias")({
  head: () => ({
    meta: [
      { title: "Preferências | Agenda Acadêmica" },
      { name: "description", content: "Escolha quais notificações por e-mail você quer receber." },
      { property: "og:title", content: "Preferências | Agenda Acadêmica" },
      {
        property: "og:description",
        content: "Escolha quais notificações por e-mail você quer receber.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Preferencias,
});

type ToggleField = Exclude<
  keyof NotificationPreferences,
  "id" | "user_id" | "created_at" | "updated_at"
>;

const TOGGLES: { field: ToggleField; label: string; description: string }[] = [
  {
    field: "email_enabled",
    label: "Notificações por e-mail",
    description: "Chave geral. Desligar interrompe todos os e-mails abaixo.",
  },
  {
    field: "remind_7_days",
    label: "Lembrete 7 dias antes",
    description: "Aviso quando falta uma semana para uma entrega.",
  },
  {
    field: "remind_3_days",
    label: "Lembrete 3 dias antes",
    description: "Aviso quando faltam 3 dias para uma entrega.",
  },
  {
    field: "remind_1_day",
    label: "Lembrete 1 dia antes",
    description: "Aviso na véspera de uma entrega.",
  },
  {
    field: "weekly_digest",
    label: "Resumo semanal",
    description: "Um e-mail por semana com tudo que vence nos próximos 7 dias.",
  },
  {
    field: "billing_alerts",
    label: "Alertas de cobrança",
    description: "Vencimento, carência e bloqueio da mensalidade.",
  },
];

function Preferencias() {
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useQuery(notificationPreferencesQuery());

  const mutation = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => updateNotificationPreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ["notification-preferences"] });
      const previous = queryClient.getQueryData<NotificationPreferences | null>([
        "notification-preferences",
      ]);
      if (previous) {
        queryClient.setQueryData(["notification-preferences"], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (error: Error, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["notification-preferences"], ctx.previous);
      toast.error(error.message || "Não foi possível salvar.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Preferências</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha quais e-mails você quer receber.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Notificações por e-mail</CardTitle>
          <CardDescription>As mudanças são salvas automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {TOGGLES.map((toggle) => {
            const checked = Boolean(prefs?.[toggle.field]);
            const disabled = toggle.field !== "email_enabled" && prefs?.email_enabled === false;
            return (
              <div
                key={toggle.field}
                className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <Label htmlFor={toggle.field} className="text-sm font-medium">
                    {toggle.label}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{toggle.description}</p>
                </div>
                <Switch
                  id={toggle.field}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => mutation.mutate({ [toggle.field]: value })}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
