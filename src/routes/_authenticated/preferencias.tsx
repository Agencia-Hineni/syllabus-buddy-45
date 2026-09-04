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
      { title: "Preferências de notificação | Agenda Acadêmica" },
      { name: "description", content: "Escolha quais lembretes por e-mail você quer receber." },
      { property: "og:title", content: "Preferências de notificação | Agenda Acadêmica" },
      {
        property: "og:description",
        content: "Escolha quais lembretes por e-mail você quer receber.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Preferencias,
});

type PrefKey = keyof Pick<
  NotificationPreferences,
  | "email_enabled"
  | "remind_7_days"
  | "remind_3_days"
  | "remind_1_day"
  | "weekly_digest"
  | "billing_alerts"
>;

const toggles: { key: PrefKey; label: string; description: string }[] = [
  {
    key: "email_enabled",
    label: "E-mails ativados",
    description: "Chave geral: desligar aqui para de todos os e-mails abaixo.",
  },
  {
    key: "remind_7_days",
    label: "Lembrete 7 dias antes",
    description: "Aviso quando faltar uma semana para o prazo.",
  },
  {
    key: "remind_3_days",
    label: "Lembrete 3 dias antes",
    description: "Aviso quando faltarem 3 dias para o prazo.",
  },
  { key: "remind_1_day", label: "Lembrete 1 dia antes", description: "Aviso na véspera do prazo." },
  {
    key: "weekly_digest",
    label: "Resumo semanal",
    description: "Um e-mail toda segunda de manhã com a semana.",
  },
  {
    key: "billing_alerts",
    label: "Avisos de cobrança",
    description: "Vencimento, bloqueio e confirmação de pagamento.",
  },
];

function Preferencias() {
  const queryClient = useQueryClient();
  const { data: prefs, isLoading } = useQuery(notificationPreferencesQuery());

  const save = useMutation({
    mutationFn: updateNotificationPreferences,
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
    onError: (e: Error, _patch, context) => {
      if (context?.previous)
        queryClient.setQueryData(["notification-preferences"], context.previous);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Preferência salva"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notification-preferences"] }),
  });

  if (isLoading) return <Skeleton className="h-96" />;

  const emailOff = prefs ? !prefs.email_enabled : false;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Preferências de notificação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha quais e-mails você quer receber.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>E-mail</CardTitle>
          <CardDescription>
            Lembretes de prazo, resumo semanal e avisos de cobrança.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {toggles.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Label htmlFor={t.key} className="text-sm font-medium">
                  {t.label}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Switch
                id={t.key}
                checked={prefs ? prefs[t.key] : false}
                disabled={t.key !== "email_enabled" && emailOff}
                onCheckedChange={(checked) => save.mutate({ [t.key]: checked })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
