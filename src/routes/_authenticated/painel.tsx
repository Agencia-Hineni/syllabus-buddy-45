import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from "lucide-react";
import {
  assignmentsQuery,
  completionsQuery,
  membershipQuery,
  type AssignmentWithSubject,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentRow } from "@/components/AssignmentRow";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel | Agenda Acadêmica" },
      { name: "description", content: "Veja o que vence nos próximos dias, o que está atrasado e o resumo da sua semana." },
      { property: "og:title", content: "Painel | Agenda Acadêmica" },
      { property: "og:description", content: "Veja o que vence nos próximos dias, o que está atrasado e o resumo da sua semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data: membership, isLoading: loadingMembership } = useQuery(membershipQuery());
  const classId = membership?.class_id;
  const { data: assignments, isLoading } = useQuery(assignmentsQuery(classId));
  const { data: completions } = useQuery(completionsQuery());

  const done = new Set(completions ?? []);
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);

  const pending = (assignments ?? []).filter((a) => !done.has(a.id));
  const overdue = pending.filter((a) => new Date(a.due_at) < now);
  const upcoming = pending.filter((a) => {
    const d = new Date(a.due_at);
    return d >= now && d <= in7;
  });
  const later = pending.filter((a) => new Date(a.due_at) > in7).slice(0, 5);
  const completedThisWeek = (assignments ?? []).filter((a) => done.has(a.id)).length;

  if (loadingMembership) return <PainelSkeleton />;

  if (!membership) {
    return (
      <EmptyState
        title="Você ainda não está em uma turma"
        description="Peça o código de convite ao líder da turma para entrar e ver as atividades."
      />
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl">Painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {membership.classes?.name} · {membership.classes?.semester}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={AlertTriangle} label="Atrasadas" value={overdue.length} tone="destructive" />
        <StatCard icon={CalendarClock} label="Próximos 7 dias" value={upcoming.length} tone="accent" />
        <StatCard icon={CheckCircle2} label="Concluídas" value={completedThisWeek} tone="success" />
      </div>

      {isLoading ? (
        <PainelSkeleton />
      ) : (
        <div className="space-y-8">
          <Section title="Atrasadas" items={overdue} empty="Nada atrasado. Bom trabalho!" />
          <Section title="Vence nos próximos 7 dias" items={upcoming} empty="Nenhuma entrega nos próximos 7 dias." />
          <Section title="Mais adiante" items={later} empty="Nenhuma outra entrega programada." />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Ver tudo na{" "}
        <Link to="/agenda" className="text-primary underline-offset-4 hover:underline">
          agenda completa
        </Link>
        .
      </p>
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: AssignmentWithSubject[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <AssignmentRow key={a.id} assignment={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock;
  label: string;
  value: number;
  tone: "destructive" | "accent" | "success";
}) {
  const toneClass =
    tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "text-accent-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className={`size-4 ${toneClass}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="font-display text-3xl font-semibold">{value}</span>
      </CardContent>
    </Card>
  );
}

function PainelSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
