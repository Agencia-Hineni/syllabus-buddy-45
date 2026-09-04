import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAdminQuery, logAudit, type Course, type Institution } from "@/lib/queries";
import { generateInviteCode } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Agenda Acadêmica" },
      {
        name: "description",
        content: "Visão geral de instituições, cursos, turmas, alunos, assinaturas e pagamentos.",
      },
      { property: "og:title", content: "Administração | Agenda Acadêmica" },
      {
        property: "og:description",
        content: "Visão geral de instituições, cursos, turmas, alunos, assinaturas e pagamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { data: isAdmin, isLoading: loadingRole } = useQuery(isAdminQuery());

  if (loadingRole) return <Skeleton className="h-40" />;
  if (!isAdmin) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Esta área é exclusiva do administrador geral."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Instituições, cursos, turmas e financeiro da plataforma
        </p>
      </header>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="instituicoes">Instituições</TabsTrigger>
          <TabsTrigger value="cursos">Cursos</TabsTrigger>
          <TabsTrigger value="turmas">Turmas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <VisaoGeral />
        </TabsContent>
        <TabsContent value="instituicoes">
          <Instituicoes />
        </TabsContent>
        <TabsContent value="cursos">
          <Cursos />
        </TabsContent>
        <TabsContent value="turmas">
          <Turmas />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VisaoGeral() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["admin-overview"],
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
    <div className="space-y-6 pt-4">
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
        {overview.classes.length === 0 ? (
          <EmptyState
            title="Nenhuma turma cadastrada"
            description="Crie a primeira instituição, curso e turma nas abas acima."
          />
        ) : (
          <ul className="space-y-2">
            {overview.classes.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border bg-card p-4 text-sm"
              >
                <span>
                  {c.name} · {c.semester}
                </span>
                <span className="text-muted-foreground">
                  {formatMoney(c.monthly_price_cents)}/mês
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Instituicoes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: async (): Promise<Institution[]> => {
      const res = await supabase.from("institutions").select("*").order("name");
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const create = useMutation({
    mutationFn: async (values: {
      name: string;
      short_name: string;
      city: string;
      state: string;
    }) => {
      const { data, error } = await supabase
        .from("institutions")
        .insert({
          name: values.name,
          short_name: values.short_name || null,
          city: values.city || null,
          state: values.state || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logAudit({
        classId: null,
        entityType: "institution",
        entityId: data.id,
        action: "create",
        summary: `Criou a instituição ${values.name}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      setOpen(false);
      toast.success("Instituição criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      <Button onClick={() => setOpen((v) => !v)}>
        <Plus className="mr-2 size-4" /> Nova instituição
      </Button>

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  name: String(fd.get("name")),
                  short_name: String(fd.get("short_name") ?? ""),
                  city: String(fd.get("city") ?? ""),
                  state: String(fd.get("state") ?? ""),
                });
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i-name">Nome</Label>
                <Input id="i-name" name="name" required placeholder="Universidade Exemplo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-short">Sigla (opcional)</Label>
                <Input id="i-short" name="short_name" placeholder="UEX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i-state">Estado (opcional)</Label>
                <Input id="i-state" name="state" placeholder="RS" maxLength={2} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i-city">Cidade (opcional)</Label>
                <Input id="i-city" name="city" placeholder="Porto Alegre" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : !institutions?.length ? (
        <EmptyState
          title="Nenhuma instituição cadastrada"
          description="Crie a primeira instituição para depois cadastrar cursos e turmas."
        />
      ) : (
        <ul className="space-y-2">
          {institutions.map((i) => (
            <li key={i.id} className="rounded-lg border bg-card p-4 text-sm">
              <p className="font-medium">
                {i.name}{" "}
                {i.short_name && <span className="text-muted-foreground">({i.short_name})</span>}
              </p>
              {(i.city || i.state) && (
                <p className="text-xs text-muted-foreground">
                  {[i.city, i.state].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Cursos() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: institutions } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: async (): Promise<Institution[]> => {
      const res = await supabase.from("institutions").select("*").order("name");
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async (): Promise<(Course & { institutions: { name: string } | null })[]> => {
      const res = await supabase.from("courses").select("*, institutions(name)").order("name");
      if (res.error) throw new Error(res.error.message);
      return res.data as (Course & { institutions: { name: string } | null })[];
    },
  });

  const create = useMutation({
    mutationFn: async (values: { institution_id: string; name: string; degree: string }) => {
      const { data, error } = await supabase
        .from("courses")
        .insert({
          institution_id: values.institution_id,
          name: values.name,
          degree: values.degree || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      await logAudit({
        classId: null,
        entityType: "course",
        entityId: data.id,
        action: "create",
        summary: `Criou o curso ${values.name}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
      setOpen(false);
      toast.success("Curso criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      <Button onClick={() => setOpen((v) => !v)} disabled={!institutions?.length}>
        <Plus className="mr-2 size-4" /> Novo curso
      </Button>
      {!institutions?.length && (
        <p className="text-sm text-muted-foreground">
          Cadastre uma instituição antes de criar um curso.
        </p>
      )}

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  institution_id: String(fd.get("institution_id")),
                  name: String(fd.get("name")),
                  degree: String(fd.get("degree") ?? ""),
                });
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="c-inst">Instituição</Label>
                <select
                  id="c-inst"
                  name="institution_id"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {(institutions ?? []).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-name">Nome do curso</Label>
                <Input id="c-name" name="name" required placeholder="Farmácia" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-degree">Grau (opcional)</Label>
                <Input id="c-degree" name="degree" placeholder="Bacharelado" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : !courses?.length ? (
        <EmptyState
          title="Nenhum curso cadastrado"
          description="Crie o primeiro curso para depois cadastrar turmas."
        />
      ) : (
        <ul className="space-y-2">
          {courses.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4 text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.institutions?.name} {c.degree && `· ${c.degree}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ClassAdminRow = {
  id: string;
  name: string;
  semester: string;
  invite_code: string;
  monthly_price_cents: number;
  grace_days: number;
  is_active: boolean;
  courses: { name: string; institutions: { name: string } | null } | null;
};

function Turmas() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState(generateInviteCode);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async (): Promise<(Course & { institutions: { name: string } | null })[]> => {
      const res = await supabase.from("courses").select("*, institutions(name)").order("name");
      if (res.error) throw new Error(res.error.message);
      return res.data as (Course & { institutions: { name: string } | null })[];
    },
  });

  const { data: classes, isLoading } = useQuery({
    queryKey: ["admin-classes"],
    queryFn: async (): Promise<ClassAdminRow[]> => {
      const res = await supabase
        .from("classes")
        .select(
          "id, name, semester, invite_code, monthly_price_cents, grace_days, is_active, courses(name, institutions(name))",
        )
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      return res.data as unknown as ClassAdminRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (values: {
      course_id: string;
      name: string;
      semester: string;
      invite_code: string;
      monthly_price: string;
      grace_days: string;
    }) => {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          course_id: values.course_id,
          name: values.name,
          semester: values.semester,
          invite_code: values.invite_code.trim().toUpperCase(),
          monthly_price_cents:
            Math.round(Number(values.monthly_price.replace(",", ".")) * 100) || 0,
          grace_days: Number(values.grace_days) || 5,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505")
          throw new Error("Já existe uma turma com esse código de convite.");
        throw new Error(error.message);
      }
      await logAudit({
        classId: data.id,
        entityType: "class",
        entityId: data.id,
        action: "create",
        summary: `Criou a turma ${values.name}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
      setOpen(false);
      setInviteCode(generateInviteCode());
      toast.success("Turma criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("classes").update({ is_active }).eq("id", id);
      if (error) throw new Error(error.message);
      await logAudit({
        classId: id,
        entityType: "class",
        entityId: id,
        action: "update",
        summary: is_active ? "Reativou a turma" : "Desativou a turma",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
      toast.success("Turma atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      <Button onClick={() => setOpen((v) => !v)} disabled={!courses?.length}>
        <Plus className="mr-2 size-4" /> Nova turma
      </Button>
      {!courses?.length && (
        <p className="text-sm text-muted-foreground">Cadastre um curso antes de criar uma turma.</p>
      )}

      {open && (
        <Card>
          <CardContent className="pt-6">
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  course_id: String(fd.get("course_id")),
                  name: String(fd.get("name")),
                  semester: String(fd.get("semester")),
                  invite_code: String(fd.get("invite_code")),
                  monthly_price: String(fd.get("monthly_price") ?? "0"),
                  grace_days: String(fd.get("grace_days") ?? "5"),
                });
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t-course">Curso</Label>
                <select
                  id="t-course"
                  name="course_id"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {(courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.institutions?.name} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-name">Nome da turma</Label>
                <Input id="t-name" name="name" required placeholder="Farmácia — Turma A" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-semester">Semestre</Label>
                <Input id="t-semester" name="semester" required placeholder="2026.2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-price">Mensalidade (R$)</Label>
                <Input
                  id="t-price"
                  name="monthly_price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="20.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-grace">Carência (dias)</Label>
                <Input id="t-grace" name="grace_days" type="number" min="0" defaultValue={5} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t-invite">Código de convite</Label>
                <div className="flex gap-2">
                  <Input
                    id="t-invite"
                    name="invite_code"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteCode(generateInviteCode())}
                  >
                    Gerar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este código com os alunos da turma.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  Salvar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : !classes?.length ? (
        <EmptyState
          title="Nenhuma turma cadastrada"
          description="Crie a primeira turma para começar a usar a agenda."
        />
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {c.name} · {c.semester}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.courses?.institutions?.name} · {c.courses?.name} · convite{" "}
                  <code className="rounded bg-secondary px-1.5 py-0.5">{c.invite_code}</code> ·{" "}
                  {formatMoney(c.monthly_price_cents)}/mês · carência {c.grace_days}d
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={c.is_active ? "secondary" : "outline"}>
                  {c.is_active ? "Ativa" : "Inativa"}
                </Badge>
                <Switch
                  checked={c.is_active}
                  aria-label={c.is_active ? "Desativar turma" : "Ativar turma"}
                  onCheckedChange={(checked) =>
                    toggleActive.mutate({ id: c.id, is_active: checked })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
