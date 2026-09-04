function esc(value: string): string {
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
  <body style="font-family: -apple-system, Segoe UI, sans-serif; background:#f4f4f5; padding:24px; margin:0;">
    <table role="presentation" width="100%" style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden;">
      <tr><td style="background:#6366f1; padding:20px 24px;">
        <span style="color:#fff; font-size:18px; font-weight:600;">Agenda Acadêmica</span>
      </td></tr>
      <tr><td style="padding:24px;">
        <h1 style="font-size:18px; margin:0 0 12px;">${title}</h1>
        ${bodyHtml}
      </td></tr>
    </table>
  </body>
</html>`;
}

export function assignmentReminderEmail(input: {
  studentName: string;
  assignmentTitle: string;
  subjectName: string;
  typeLabel: string;
  dueAtFormatted: string;
  daysUntil: 7 | 3 | 1;
}): { subject: string; html: string } {
  const dayWord = input.daysUntil === 1 ? "amanhã" : `em ${input.daysUntil} dias`;
  // Assunto do e-mail: texto puro, não precisa (nem deve) ser escapado como HTML.
  const subject = `${input.typeLabel} de ${input.subjectName} vence ${dayWord}`;
  const html = layout(
    esc(subject),
    `<p>Oi, ${esc(input.studentName)}!</p>
     <p><strong>${esc(input.assignmentTitle)}</strong> (${esc(input.subjectName)}) vence em <strong>${esc(input.dueAtFormatted)}</strong>.</p>
     <p style="color:#71717a; font-size:13px;">Você pode ajustar esses lembretes a qualquer momento nas preferências de notificação.</p>`,
  );
  return { subject, html };
}

export function weeklyDigestEmail(input: {
  studentName: string;
  weekLabel: string;
  items: { title: string; subjectName: string; dueAtFormatted: string }[];
}): { subject: string; html: string } {
  const subject = `Sua semana na Agenda Acadêmica — ${input.weekLabel}`;
  const list = input.items.length
    ? `<ul style="padding-left:18px; margin:0;">${input.items
        .map(
          (i) =>
            `<li style="margin-bottom:6px;">${esc(i.title)} (${esc(i.subjectName)}) — ${esc(i.dueAtFormatted)}</li>`,
        )
        .join("")}</ul>`
    : `<p style="color:#71717a;">Nenhuma entrega marcada para esta semana.</p>`;
  const html = layout(
    esc(subject),
    `<p>Oi, ${esc(input.studentName)}! Aqui está o resumo da sua semana:</p>${list}`,
  );
  return { subject, html };
}

export function paymentConfirmedEmail(input: {
  studentName: string;
  amountFormatted: string;
  validUntilFormatted: string;
}): {
  subject: string;
  html: string;
} {
  const subject = "Pagamento confirmado";
  const html = layout(
    subject,
    `<p>Oi, ${esc(input.studentName)}!</p>
     <p>Recebemos seu pagamento de <strong>${esc(input.amountFormatted)}</strong>. Sua assinatura está ativa até <strong>${esc(input.validUntilFormatted)}</strong>.</p>`,
  );
  return { subject, html };
}
