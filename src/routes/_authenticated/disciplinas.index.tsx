import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, User } from "lucide-react";
import { assignmentsQuery, membershipQuery, subjectsQuery } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/disciplinas/")({
  head: () => ({
    meta: [
      { title: "Disciplinas | Agenda Acadêmica" },
      { name: "description", content: "As matérias do semestre com professor, horário e atividades relacionadas." },
      { property: "og:title", content: "Disciplinas | Agenda Acadêmica" },
      { property: "og:description", content: "As matérias do semestre com professor, horário e atividades relacionadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Disciplinas,
});

function Disciplinas() {
  const { data: membership } = useQuery(membershipQuery());
  const classId = membership?.class_id;
  const { data: subjects, isLoading } = useQuery(subjectsQuery(classId));
  const { data: assignments } = useQuery(assignmentsQuery(classId));

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!subjects || subjects.length === 0) {
    return (
      <EmptyState
        title="Nenhuma disciplina cadastrada"
        description="O líder da turma ainda não cadastrou as matérias do semestre."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Disciplinas</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subjects.length} matérias neste semestre</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {subjects.map((s) => {
          const count = (assignments ?? []).filter((a) => a.subject_id === s.id).length;
          return (
            <Link
              key={s.id}
              to="/disciplinas/$id"
              params={{ id: s.id }}
              className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h2 className="text-base font-semibold group-hover:text-primary">{s.name}</h2>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {s.professor && (
                      <p className="flex items-center gap-2">
                        <User className="size-3.5" /> {s.professor}
                      </p>
                    )}
                    {s.schedule && (
                      <p className="flex items-center gap-2">
                        <Clock className="size-3.5" /> {s.schedule}
                      </p>
                    )}
                    <p>{count} atividade(s)</p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
