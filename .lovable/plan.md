# Agenda Acadêmica — MVP da turma de Farmácia

Um site onde os alunos veem as disciplinas, as atividades e provas com prazos, recebem lembretes por e-mail, e os líderes/vice-líderes cadastram e editam o conteúdo. Estrutura já preparada para crescer para outros cursos e turmas.

## O que o aluno vê

- **Login** com e-mail/senha ou Google.
- **Painel inicial**: o que vence nos próximos 7 dias, atrasados, e resumo da semana.
- **Minhas disciplinas**: lista das matérias do semestre com professor, horário e cor.
- **Disciplina**: todas as atividades e provas daquela matéria, com prazo, descrição e anexos por link.
- **Agenda/calendário**: visão mensal e lista, filtrando por disciplina.
- **Marcar como feito**: cada aluno marca suas próprias entregas (não afeta os outros).
- **Lembretes por e-mail** automáticos: 7 dias, 3 dias e 1 dia antes do prazo, e um resumo semanal na segunda de manhã. O aluno escolhe nas preferências quais quer receber.

## O que o líder / vice-líder faz

- Mesmo acesso do aluno, mais um **painel de gestão da turma**:
  - criar/editar/excluir disciplinas do semestre;
  - criar/editar/excluir atividades e provas (título, tipo, descrição, prazo, peso, link);
  - ver quem já entrou na turma e quem está com pagamento pendente;
  - gerar o código de convite da turma.
- Histórico simples de quem alterou o quê, para evitar confusão entre líder e vice.

## Assinatura, Pix automático e bloqueio

- Assinatura mensal por aluno, com dois caminhos, **ambos com baixa automática**:
  - **Cartão de crédito** — cobrança recorrente automática via Lovable Stripe.
  - **Pix** — integrado com a **Efí/Gerencianet da sua agência**: cada aluno tem um QR Code/copia-e-cola do próximo mês, o webhook da Efí confirma o pagamento em segundos e libera o acesso sozinho.
- **Por que Efí para Pix**: menor taxa de Pix no Brasil (geralmente 0,99% ou valor fixo pequeno, dependendo do contrato da agência) e você já está dentro da agência. O código de pagamentos fica isolado, então dá para trocar o provedor futuramente sem mexer no resto do app.
- **Regra de bloqueio**: passado o vencimento e a carência (ex.: 5 dias, configurável), a conta entra em modo bloqueado — o aluno entra e vê só a tela de pagamento. Ao cair o Pix ou a cobrança do cartão, o acesso volta na hora.
- Aviso automático por e-mail 3 dias antes do vencimento, no dia, e no bloqueio.
- Painel do administrador com: ativo, pendente, bloqueado, recebido no mês e histórico de pagamentos.



## Preparado para escalar

Desde o início a estrutura tem os níveis: **Instituição → Curso → Turma (semestre) → Disciplina → Atividade**. No MVP existe uma instituição, o curso de Farmácia e uma turma real, mas nada fica "chumbado": criar outro curso ou turma no futuro é cadastro, não reescrita. Permissões são por turma (aluno, líder, vice-líder) mais um papel de administrador geral (você).

## Detalhes técnicos

- **Portabilidade (sem lock-in)**: o backend roda no Lovable Cloud, mas por baixo é **Postgres puro**. Todo o esquema nasce em arquivos de migration SQL versionados no repositório, sem recurso proprietário. Autenticação usa Supabase Auth (padrão aberto, JWT) e as regras de acesso são RLS do próprio Postgres. Resultado: um `pg_dump` + as migrations rodam em qualquer Postgres (Neon, RDS, VPS) e o front continua funcionando trocando as variáveis de ambiente.
- **Camadas isoladas**: acesso a dados, pagamentos e envio de e-mail ficam cada um atrás de uma interface própria (`db`, `payments`, `mailer`). Trocar provedor de pagamento, de e-mail ou de banco é substituir a implementação daquela camada.
- **Papéis**: tabela separada de papéis por turma (`aluno`, `lider`, `vice_lider`) e papel global `admin`, verificados no servidor via função de segurança — nunca no navegador. RLS em todas as tabelas: aluno só lê a própria turma; escrita de disciplinas/atividades restrita a líder/vice/admin.
- **Tabelas principais**: `institutions`, `courses`, `classes`, `class_members`, `subjects`, `assignments`, `assignment_completions`, `subscriptions`, `payments`, `payment_webhook_events`, `notification_preferences`, `notification_log`, `audit_log`. Toda tabela nova recebe os GRANTs correspondentes.
- **Bloqueio**: status calculado a partir de `subscriptions.current_period_end` + carência, aplicado tanto na interface quanto nas próprias políticas de leitura, para não ser contornável.
- **Pix automático**: rota pública `/api/public/webhooks/pagamentos` recebe a notificação do provedor, valida a assinatura/segredo, consulta o pagamento na API oficial para confirmar valor e status, grava em `payments` de forma idempotente (evento único por ID) e estende `current_period_end`. Chave de API do provedor guardada como secret, nunca no código.
- **E-mails**: sistema de e-mails do Lovable com templates React Email (lembrete de prazo, resumo semanal, boas-vindas, aviso de vencimento). Disparo por job diário que busca prazos na janela e envia um e-mail por aluno, com registro para não duplicar. Requer configurar um domínio de envio — te guio nesse passo.
- **Rotas**: `/` (marketing + login), `/painel`, `/disciplinas`, `/disciplinas/$id`, `/agenda`, `/gestao` (líderes), `/admin` (você), `/assinatura`, todas com metadados próprios.

## Ordem de construção

1. Banco + autenticação (e-mail e Google), migrations versionadas, RLS e a turma de Farmácia semeada.
2. Área do aluno: painel, disciplinas, atividades, calendário, marcar como feito.
3. Área de gestão para líder/vice + administração geral.
4. Assinatura: definição do provedor, Pix com QR Code e baixa automática por webhook, cartão recorrente, bloqueio por inadimplência.
5. E-mails: domínio, templates e disparo automático dos lembretes.

