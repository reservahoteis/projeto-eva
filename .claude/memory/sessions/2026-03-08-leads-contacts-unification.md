# Sessao: Unificacao Leads + Contatos

- Data: 2026-03-08
- Duracao: ~2h (2 sessoes, context overflow na primeira)

## Objetivos
1. Unificar Leads e Contatos numa unica pagina
2. Corrigir erros TypeScript
3. Popular banco local com dados de producao
4. Reset de senha usuario

## Arquivos Modificados

### Frontend
- `src/app/crm/leads/page.tsx` — list view mostra contatos, kanban/groupby intacto
- `src/app/crm/leads/[leadId]/page.tsx` — reescrito para carregar contato do Express
- `src/components/crm/crm-sidebar.tsx` — removido item "contacts"
- `src/app/crm/contacts/[contactId]/page.tsx` — fix null guard lastMessageAt
- `src/app/crm/escalations/page.tsx` — fix null guard STATUS_CONFIG
- `src/app/crm/logs/page.tsx` — removido imports nao usados
- `src/app/crm/opportunities/page.tsx` — removido imports nao usados

## Decisoes Tomadas
- Ver `decisions/2026-03-08-leads-contacts-merge.md`

## Bugs Corrigidos
- 6 erros TypeScript (imports nao usados, null guards)
- `RangeError: Invalid time value` em contacts detail (lastMessageAt null)
- Login falhava apos reset senha (bcrypt hash corrompido por shell escaping)

## Notas
- Banco local populado via dump da VPS (2468 contatos, 2515 conversas, 45578 msgs)
- SSH correto para VPS: `ssh crm-vps` (key: `~/.ssh/vps_crm`)
- bcrypt hashes devem ser gerados via Python dentro do container (shell escapa `$`)
