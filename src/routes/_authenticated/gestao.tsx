import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  assignmentsQuery,
  isAdminQuery,
  logAudit,
  membersQuery,
  membershipQuery,
  subjectsQuery,
  type Assignment,
  type AssignmentType,
  type Subject,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatMoney, typeLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/gestao")({
  head: () => ({
    meta: [
      { title: "Gestão da turma | Agenda Acadêmica" },
      { name: "description", content: "Líderes e vice-líderes cadastram disciplinas, atividades e provas da turma." },
      { property: "og:title", content: "Gestão da turma | Agenda Acadêmica" },
      { property: "og:description", content: "Líderes e vice-líderes cadastram disciplinas, atividades e provas da turma." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Gestao,
});

const TYPES: AssignmentType[] = ["atividade", "prova", "trabalho", "seminario", "outro"];

function Gestao() {
  const queryClient = useQueryClient();
  const { data: membership } = useQuery(membershipQuery());
  const { data: isAdmin } = useQuery(isAdminQuery());
  const classId = membership?.class_id;
  const { data: subjects } = useQuery(subjectsQuery(classId));
  const { data: assignments } = useQuery(assignmentsQuery(classId));
  const { data: members } = useQuery(membersQuery(classId));

  const canManage = isAdmin || membership?.role === "lider" || membership?.role === "vice_lider";

  const [subjectDialog, setSubjectDialog] = useState<Partial<Subject> | null>(null);
  const [assignmentDialog, setAssignmentDialog] = useState<Partial<Assignment> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "subject" | "assignment"; id: string; title: string } | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subjects"] });
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
  };

  const saveSubject = useMutation({
    mutationFn: async (values: Partial<Subject>) => {
      if (!classId) throw new Error("Sem turma");
      const payload = {
        class_id: classId,
        name: values.name!,
        professor: values.professor ?? null,
        schedule: values.schedule ?? null,
        color: values.color ?? "#6366f1",
      };
      if (values.id) {
        const { error } = await supabase.from("subjects").update(payload).eq("id", values.id);
        if (error) throw new Error(error.message);
        await logAudit({ classId, entityType: "subject", entityId: values.id, action: "update", summary: `Editou a disciplina ${payload.name}` });
      } else {
        const { error } = await supabase.from("subjects").insert(payload);
        if (error) throw new Error(error.message);
        await logAudit({ classId, entityType: "subject", action: "create", summary: `Criou a disciplina ${payload.name}` });
      }
    },
    onSuccess: () => {
      invalidate();
      setSubjectDialog(null);
      toast.success("Disciplina salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAssignment = useMutation({
    mutationFn: async (values: Partial<Assignment>) => {
      if (!classId) throw new Error("Sem turma");
      const payload = {
        class_id: classId,
        subject_id: values.subject_id!,
        title: values.title!,
        type: (values.type ?? "atividade") as AssignmentType,
        description: values.description ?? null,
        due_at: new Date(values.due_at!).toISOString(),
        weight: values.weight ?? null,
        link_url: values.link_url ?? null,
      };
      if (values.id) {
        const { error } = await supabase.from("assignments").update(payload).eq("id", values.id);
        if (error) throw new Error(error.message);
        await logAudit({ classId, entityType: "assignment", entityId: values.id, action: "update", summary: `Editou "${payload.title}"` });
      } else {
        const { error } = await supabase.from("assignments").insert(payload);
        if (error) throw new Error(error.message);
        await logAudit({ classId, entityType: "assignment", action: "create", summary: `Criou "${payload.title}"` });
      }
    },
    onSuccess: () => {
      invalidate();
      setAssignmentDialog(null);
      toast.success("Atividade salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async ({ kind, id, title }: { kind: "subject" | "assignment"; id: string; title: string }) => {
      const table = kind === "subject" ? "subjects" : "assignments";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
      await logAudit({ classId: classId ?? null, entityType: kind, entityId: id, action: "delete", summary: `Excluiu "${title}"` });
    },
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
      toast.success("Excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canManage) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Apenas líder, vice-líder e administrador podem gerenciar a turma."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl">Gestão da turma</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {membership?.classes?.name} · código de convite:{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5">{membership?.classes?.invite_code}</code>
        </p>
      </header>

      <Tabs defaultValue="atividades">
        <TabsList>
          <TabsTrigger value="atividades">Atividades</TabsTrigger>
          <TabsTrigger value="disciplinas">Disciplinas</TabsTrigger>
          <TabsTrigger value="membros">Membros</TabsTrigger>
        </TabsList>

        <TabsContent value="atividades" className="space-y-4">
          <Button onClick={() => setAssignmentDialog({ type: "atividade" })} disabled={!subjects?.length}>
            <Plus className="mr-2 size-4" /> Nova atividade
          </Button>
          {!subjects?.length && (
            <p className="text-sm text-muted-foreground">Cadastre uma disciplina antes de criar atividades.</p>
          )}
          {(assignments ?? []).length === 0 ? (
            <EmptyState title="Nenhuma atividade" description="Crie a primeira atividade ou prova da turma." />
          ) : (
            <ul className="space-y-2">
              {(assignments ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.subjects?.name} · {typeLabel(a.type)} · {formatDate(a.due_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setAssignmentDialog(a)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      onClick={() => setConfirmDelete({ kind: "assignment", id: a.id, title: a.title })}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="disciplinas" className="space-y-4">
          <Button onClick={() => setSubjectDialog({ color: "#6366f1" })}>
            <Plus className="mr-2 size-4" /> Nova disciplina
          </Button>
          <ul className="space-y-2">
            {(subjects ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.professor ?? "Sem professor"} · {s.schedule ?? "Sem horário"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setSubjectDialog(s)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    onClick={() => setConfirmDelete({ kind: "subject", id: s.id, title: s.name })}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="membros">
          {!members?.length ? (
            <EmptyState title="Ninguém entrou ainda" description="Compartilhe o código de convite com a turma." />
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.profile?.full_name ?? m.profile?.email ?? "Aluno"}</p>
                    <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{m.role}</Badge>
                    <Badge variant={m.subscription?.status === "blocked" ? "destructive" : "secondary"}>
                      {m.subscription?.status ?? "sem assinatura"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogo disciplina */}
      <Dialog open={subjectDialog !== null} onOpenChange={(o) => !o && setSubjectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{subjectDialog?.id ? "Editar disciplina" : "Nova disciplina"}</DialogTitle>
          </DialogHeader>
          <form
            id="subject-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              saveSubject.mutate({
                id: subjectDialog?.id,
                name: String(fd.get("name")),
                professor: String(fd.get("professor")),
                schedule: String(fd.get("schedule")),
                color: String(fd.get("color")),
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="s-name">Nome</Label>
              <Input id="s-name" name="name" required defaultValue={subjectDialog?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-prof">Professor</Label>
              <Input id="s-prof" name="professor" defaultValue={subjectDialog?.professor ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-sched">Horário</Label>
              <Input id="s-sched" name="schedule" defaultValue={subjectDialog?.schedule ?? ""} placeholder="Seg 19:00 - 22:00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-color">Cor</Label>
              <Input id="s-color" name="color" type="color" className="h-10 w-20" defaultValue={subjectDialog?.color ?? "#6366f1"} />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="subject-form" disabled={saveSubject.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo atividade */}
      <Dialog open={assignmentDialog !== null} onOpenChange={(o) => !o && setAssignmentDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{assignmentDialog?.id ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          </DialogHeader>
          <form
            id="assignment-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const weightRaw = String(fd.get("weight") ?? "");
              saveAssignment.mutate({
                id: assignmentDialog?.id,
                subject_id: String(fd.get("subject_id")),
                title: String(fd.get("title")),
                type: String(fd.get("type")) as AssignmentType,
                description: String(fd.get("description")),
                due_at: String(fd.get("due_at")),
                weight: weightRaw ? Number(weightRaw) : null,
                link_url: String(fd.get("link_url")) || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="a-title">Título</Label>
              <Input id="a-title" name="title" required defaultValue={assignmentDialog?.title ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-subject">Disciplina</Label>
              <select
                id="a-subject"
                name="subject_id"
                required
                defaultValue={assignmentDialog?.subject_id ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {(subjects ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-type">Tipo</Label>
              <select
                id="a-type"
                name="type"
                defaultValue={assignmentDialog?.type ?? "atividade"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-due">Prazo</Label>
              <Input
                id="a-due"
                name="due_at"
                type="datetime-local"
                required
                defaultValue={
                  assignmentDialog?.due_at
                    ? new Date(assignmentDialog.due_at).toISOString().slice(0, 16)
                    : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-weight">Peso (opcional)</Label>
              <Input id="a-weight" name="weight" type="number" step="0.1" min="0" defaultValue={assignmentDialog?.weight ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-link">Link / anexo (opcional)</Label>
              <Input id="a-link" name="link_url" type="url" defaultValue={assignmentDialog?.link_url ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-desc">Descrição</Label>
              <Textarea id="a-desc" name="description" rows={3} defaultValue={assignmentDialog?.description ?? ""} />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="assignment-form" disabled={saveAssignment.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{confirmDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e vale para toda a turma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && remove.mutate(confirmDelete)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
