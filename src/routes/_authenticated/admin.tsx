import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Agenda Acadêmica" },
      { name: "description", content: "Visão geral de instituições, cursos, turmas, alunos, assinaturas e pagamentos." },
      { property: "og:title", content: "Administração | Agenda Acadêmica" },
      { property: "og:description", content: "Visão geral de instituições, cursos, turmas, alunos, assinaturas e pagamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { data: isAdmin, isLoading: loadingRole } = useQuery(isAdminQuery());

  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    enabled: Boolean(isAdmin),
    queryFn: async () => {
      const [institutions, courses, classes, members, subscriptions, payments] = await Promise.all([
        supabase.from("institutions").select("id, name"),
        supabase.from("courses").select("id, name"),
        supabase.from("classes").select("id, name, semester, monthly_price_cents"),
        supabase.from("class_members").select("id, role, status"),
        supabase.from("subscriptions").select("id, status"),
        supabase.from("payments").select("id, amount_cents, status, created_at"),
      ]);
      return {
        institutions: institutions.data ?? [],
        courses: courses.data ?? [],
        classes: classes.data ?? [],
        members: members.data ?? [],
        subscriptions: subscriptions.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  if (loadingRole) return <Skeleton className="h-40" />;
  if (!isAdmin) {
    return <EmptyState title="Acesso restrito" description="Esta área é exclusiva do administrador geral." />;
  }
  if (isLoading || !overview) return <Skeleton className="h-40" />;

  const paid = overview.payments.filter((p) => p.status === "paid");
  const received = paid.reduce((sum, p) => sum + p.amount_cents, 0);
  const blocked = overview.subscriptions.filter((s) => s.status === "blocked").length;
  const active = overview.subscriptions.filter((s) => s.status === "active").length;

  const stats = [
    { label: "Instituições", value: overview.institutions.length },
    { label: "Cursos", value: overview.courses.length },
    { label: "Turmas", value: overview.classes.length },
    { label: "Alunos", value: overview.members.length },
    { label: "Assinaturas ativas", value: active },
    { label: "Bloqueadas", value: blocked },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da plataforma</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="font-display text-3xl font-semibold">{s.value}</span>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-display text-3xl font-semibold">{formatMoney(received)}</span>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg">Turmas</h2>
        <ul className="space-y-2">
          {overview.classes.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm">
              <span>
                {c.name} · {c.semester}
              </span>
              <span className="text-muted-foreground">{formatMoney(c.monthly_price_cents)}/mês</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
