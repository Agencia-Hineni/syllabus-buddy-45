import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, CalendarCheck2, GraduationCap, ListChecks, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Agenda Acadêmica — prazos e provas da sua turma" },
      {
        name: "description",
        content:
          "Todas as disciplinas, atividades, provas e prazos da turma em um só lugar, com lembretes automáticos por e-mail.",
      },
      { property: "og:title", content: "Agenda Acadêmica — prazos e provas da sua turma" },
      {
        property: "og:description",
        content:
          "Todas as disciplinas, atividades, provas e prazos da turma em um só lugar, com lembretes automáticos por e-mail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ListChecks,
    title: "Nada passa batido",
    text: "Atividades, trabalhos e provas com prazo, peso e link do enunciado — organizados por disciplina.",
  },
  {
    icon: BellRing,
    title: "Lembretes automáticos",
    text: "Avisos por e-mail 7, 3 e 1 dia antes de cada entrega, mais o resumo da semana na segunda-feira.",
  },
  {
    icon: CalendarCheck2,
    title: "Agenda de verdade",
    text: "Visão mensal e em lista, com cores por disciplina e diferenciação entre atividade e prova.",
  },
  {
    icon: Users,
    title: "Líder e vice no controle",
    text: "Quem representa a turma cadastra e edita o conteúdo. O resto da turma só precisa consultar.",
  },
  {
    icon: ShieldCheck,
    title: "Cada um vê a própria turma",
    text: "As regras de acesso ficam no banco de dados, não apenas na tela.",
  },
  {
    icon: GraduationCap,
    title: "Pronto para crescer",
    text: "Instituição, curso e turma são cadastros — adicionar um novo curso não exige reescrever nada.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-6 text-primary" />
          <span className="font-display text-lg font-semibold">Agenda Acadêmica</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:px-8 md:pb-24 md:pt-20">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
            Feito para turmas de graduação
          </p>
          <h1 className="text-4xl leading-tight md:text-6xl">
            A turma inteira sabendo <span className="text-primary">o que vence quando</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Uma agenda compartilhada com as disciplinas do semestre, cada atividade e prova com prazo, e
            lembretes automáticos por e-mail. O líder cadastra uma vez; todo mundo fica em dia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Começar agora</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y bg-secondary/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:grid-cols-2 md:px-8 lg:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="mb-3 size-5 text-primary" />
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground md:px-8">
        Agenda Acadêmica · organização para turmas universitárias
      </footer>
    </div>
  );
}
