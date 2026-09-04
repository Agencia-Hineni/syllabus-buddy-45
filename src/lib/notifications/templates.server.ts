import { formatDate, formatMoney, typeLabel } from "@/lib/format";
import type { AssignmentType } from "@/lib/queries";

// Every interpolated value below comes from user-controlled data (assignment
// titles, subject names, profile names) that ends up in an outbound email —
// escape it or it's a stored-HTML-injection vector.
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#4f46e5;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:600;">Agenda Acadêmica</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="font-size:18px;margin:0 0 16px;">${esc(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#fafafa;font-size:12px;color:#71717a;">
                Você recebeu este e-mail porque está matriculado em uma turma na Agenda Acadêmica.
                Ajuste suas preferências de notificação em Preferências, dentro do app.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function assignmentReminderEmail(input: {
  studentName: string;
  title: string;
  type: AssignmentType;
  subjectName: string;
  dueAt: string;
  daysLeft: number;
}): { subject: string; html: string } {
  const dayWord = input.daysLeft === 1 ? "dia" : "dias";
  const subject = `${typeLabel(input.type)} "${input.title}" vence em ${input.daysLeft} ${dayWord}`;
  const html = layout(
    subject,
    `<p>Olá, ${esc(input.studentName)}.</p>
     <p><strong>${esc(input.title)}</strong> (${esc(typeLabel(input.type))}) de <strong>${esc(input.subjectName)}</strong> vence em <strong>${formatDate(input.dueAt)}</strong>.</p>
     <p>Faltam ${input.daysLeft} ${dayWord}.</p>`,
  );
  return { subject, html };
}

export function weeklyDigestEmail(input: {
  studentName: string;
  className: string;
  items: { title: string; type: AssignmentType; subjectName: string; dueAt: string }[];
}): { subject: string; html: string } {
  const subject = `Sua semana na turma ${input.className}`;
  const rows =
    input.items.length === 0
      ? `<p>Nenhuma entrega prevista para os próximos 7 dias. Aproveite para adiantar os estudos.</p>`
      : `<ul style="padding-left:18px;margin:0;">
          ${input.items
            .map(
              (item) =>
                `<li style="margin-bottom:8px;"><strong>${esc(item.title)}</strong> — ${esc(item.subjectName)} (${esc(typeLabel(item.type))}) em ${formatDate(item.dueAt)}</li>`,
            )
            .join("")}
        </ul>`;
  const html = layout(
    subject,
    `<p>Olá, ${esc(input.studentName)}.</p><p>Aqui está o que vence nos próximos 7 dias:</p>${rows}`,
  );
  return { subject, html };
}

export function billingDueEmail(input: {
  studentName: string;
  className: string;
  amountCents: number;
  graceDays: number;
}): { subject: string; html: string } {
  const subject = `Mensalidade da turma ${input.className} venceu`;
  const html = layout(
    subject,
    `<p>Olá, ${esc(input.studentName)}.</p>
     <p>A mensalidade de <strong>${formatMoney(input.amountCents)}</strong> da turma <strong>${esc(input.className)}</strong> venceu.</p>
     <p>Você tem <strong>${input.graceDays} dias</strong> de carência para regularizar antes que o acesso seja bloqueado.</p>`,
  );
  return { subject, html };
}

export function billingBlockedEmail(input: {
  studentName: string;
  className: string;
  amountCents: number;
}): { subject: string; html: string } {
  const subject = `Acesso à turma ${input.className} bloqueado`;
  const html = layout(
    subject,
    `<p>Olá, ${esc(input.studentName)}.</p>
     <p>Seu acesso à turma <strong>${esc(input.className)}</strong> foi bloqueado por falta de pagamento da mensalidade de <strong>${formatMoney(input.amountCents)}</strong>.</p>
     <p>Assim que o pagamento for confirmado, o acesso é liberado automaticamente.</p>`,
  );
  return { subject, html };
}

export function paymentConfirmedEmail(input: {
  studentName: string;
  className: string;
  amountCents: number;
}): { subject: string; html: string } {
  const subject = `Pagamento confirmado — ${input.className}`;
  const html = layout(
    subject,
    `<p>Olá, ${esc(input.studentName)}.</p>
     <p>Recebemos seu pagamento de <strong>${formatMoney(input.amountCents)}</strong> para a turma <strong>${esc(input.className)}</strong>.</p>
     <p>Seu acesso está liberado. Obrigado!</p>`,
  );
  return { subject, html };
}
