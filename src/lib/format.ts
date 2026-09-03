import { format, formatDistanceToNowStrict, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AssignmentType } from "@/lib/queries";

export function formatDueDate(iso: string): string {
  const date = new Date(iso);
  const rel = formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true });
  return `${format(date, "dd MMM 'às' HH:mm", { locale: ptBR })} · ${rel}`;
}

export function formatDate(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
}

export function isOverdue(iso: string): boolean {
  return isPast(new Date(iso));
}

const labels: Record<AssignmentType, string> = {
  atividade: "Atividade",
  prova: "Prova",
  trabalho: "Trabalho",
  seminario: "Seminário",
  outro: "Outro",
};

export function typeLabel(type: AssignmentType): string {
  return labels[type] ?? type;
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
