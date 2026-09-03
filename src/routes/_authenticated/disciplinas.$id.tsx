import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, User } from "lucide-react";
import { assignmentsQuery, membershipQuery, subjectsQuery } from "@/lib/queries";
import { AssignmentRow } from "@/components/AssignmentRow";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/disciplinas/$id")({
  head: () => ({
    meta: [
      { title: "Disciplina | Agenda Acadêmica" },
      { name: "description", content: "Atividades e provas da disciplina, com prazo, peso, descrição e anexos." },
      { property: "og:title", content: "Disciplina | Agenda Acadêmica" },
      { property: "og:description", content: "Atividades e provas da disciplina, com prazo, peso, descrição e anexos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisciplinaDetalhe,
});

function DisciplinaDetalhe() {
  const { id } = Route.useParams();
  const { data: membership } = useQuery(membershipQuery());
  const classId = membership?.class_id;
  const { data: subjects, isLoading } = useQuery(subjectsQuery(classId));
  const { data: assignments } = useQuery(assignmentsQuery(classId));

  const subject = (subjects ?? []).find((s) => s.id === id);
  const items = (assignments ?? []).filter((a) => a.subject_id === id);

  if (isLoading) return <Skeleton className="h-64" />;
  if (!subject) {
    return <EmptyState title="Disciplina não encontrada" description="Ela pode ter sido removida da turma." />;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/disciplinas"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Disciplinas
      </Link>

      <header className="flex items-start gap-4">
        <span className="mt-1 h-12 w-2 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden />
        <div>
          <h1 className="text-2xl md:text-3xl">{subject.name}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {subject.professor && (
              <span className="flex items-center gap-2">
                <User className="size-4" /> {subject.professor}
              </span>
            )}
            {subject.schedule && (
              <span className="flex items-center gap-2">
                <Clock className="size-4" /> {subject.schedule}
              </span>
            )}
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState title="Nenhuma atividade" description="Ainda não há atividades ou provas nesta disciplina." />
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <AssignmentRow key={a.id} assignment={a} />
          ))}
        </ul>
      )}
    </div>
  );
}
