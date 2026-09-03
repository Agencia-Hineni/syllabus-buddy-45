import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { assignmentsQuery, membershipQuery, subjectsQuery } from "@/lib/queries";
import { AssignmentRow } from "@/components/AssignmentRow";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda | Agenda Acadêmica" },
      { name: "description", content: "Calendário mensal e lista de atividades e provas da turma, com filtro por disciplina." },
      { property: "og:title", content: "Agenda | Agenda Acadêmica" },
      { property: "og:description", content: "Calendário mensal e lista de atividades e provas da turma, com filtro por disciplina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agenda,
});

function Agenda() {
  const { data: membership } = useQuery(membershipQuery());
  const classId = membership?.class_id;
  const { data: subjects } = useQuery(subjectsQuery(classId));
  const { data: assignments } = useQuery(assignmentsQuery(classId));

  const [month, setMonth] = useState(() => new Date());
  const [filter, setFilter] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const items = useMemo(
    () => (assignments ?? []).filter((a) => filter === "all" || a.subject_id === filter),
    [assignments, filter],
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const dayItems = selectedDay ? items.filter((a) => isSameDay(new Date(a.due_at), selectedDay)) : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Atividades e provas da turma</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              filter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-accent/20",
            )}
          >
            Todas
          </button>
          {(subjects ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => setFilter(s.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                filter === s.id ? "bg-primary text-primary-foreground" : "hover:bg-accent/20",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden />
              {s.name}
            </button>
          ))}
        </div>
      </header>

      <Tabs defaultValue="mes">
        <TabsList>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="mes" className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mês anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-display text-lg capitalize">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border text-center text-xs">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="bg-secondary py-2 font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dItems = items.filter((a) => isSameDay(new Date(a.due_at), day));
              const selected = selectedDay && isSameDay(day, selectedDay);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-16 bg-card p-1.5 text-left align-top transition-colors hover:bg-accent/10",
                    !isSameMonth(day, month) && "text-muted-foreground/50",
                    selected && "ring-2 ring-inset ring-primary",
                  )}
                >
                  <span className="text-xs">{format(day, "d")}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {dItems.slice(0, 3).map((a) => (
                      <span
                        key={a.id}
                        title={a.title}
                        className={cn("h-1.5 w-1.5 rounded-full", a.type === "prova" && "h-1.5 w-4 rounded-sm")}
                        style={{ backgroundColor: a.subjects?.color ?? "#6366f1" }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Bolinha = atividade · Barra = prova. Clique num dia para ver os detalhes.
          </p>

          {selectedDay && (
            <section>
              <h2 className="mb-3 text-lg capitalize">
                {format(selectedDay, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h2>
              {dayItems.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Nada marcado para este dia.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dayItems.map((a) => (
                    <AssignmentRow key={a.id} assignment={a} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </TabsContent>

        <TabsContent value="lista">
          {items.length === 0 ? (
            <EmptyState title="Nada por aqui" description="Nenhuma atividade cadastrada para este filtro." />
          ) : (
            <ul className="space-y-2">
              {items.map((a) => (
                <AssignmentRow key={a.id} assignment={a} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
