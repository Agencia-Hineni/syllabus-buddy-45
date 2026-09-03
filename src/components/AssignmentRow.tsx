import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { completionsQuery, type AssignmentWithSubject } from "@/lib/queries";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatDueDate, isOverdue, typeLabel } from "@/lib/format";

export function AssignmentRow({ assignment }: { assignment: AssignmentWithSubject }) {
  const queryClient = useQueryClient();
  const { data: completions } = useQuery(completionsQuery());
  const done = (completions ?? []).includes(assignment.id);

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      if (next) {
        const { error } = await supabase
          .from("assignment_completions")
          .insert({ assignment_id: assignment.id, user_id: uid });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("assignment_completions")
          .delete()
          .eq("assignment_id", assignment.id)
          .eq("user_id", uid);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_d, next) => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      toast.success(next ? "Marcada como concluída" : "Desmarcada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const overdue = !done && isOverdue(assignment.due_at);
  const color = assignment.subjects?.color ?? "#6366f1";

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <Checkbox
        checked={done}
        onCheckedChange={(v) => toggle.mutate(Boolean(v))}
        disabled={toggle.isPending}
        aria-label={`Marcar ${assignment.title} como concluída`}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className={`font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
            {assignment.title}
          </span>
          <Badge variant={assignment.type === "prova" ? "destructive" : "secondary"}>
            {typeLabel(assignment.type)}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {assignment.subjects && (
            <Link
              to="/disciplinas/$id"
              params={{ id: assignment.subjects.id }}
              className="underline-offset-4 hover:underline"
            >
              {assignment.subjects.name}
            </Link>
          )}
          <span className={overdue ? "font-medium text-destructive" : ""}>
            {formatDueDate(assignment.due_at)}
          </span>
          {assignment.weight != null && <span>Peso {assignment.weight}</span>}
          {assignment.link_url && (
            <a
              href={assignment.link_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            >
              Anexo <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        {assignment.description && (
          <p className="mt-2 text-sm text-muted-foreground">{assignment.description}</p>
        )}
      </div>
    </li>
  );
}
