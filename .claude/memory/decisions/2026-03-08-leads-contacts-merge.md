# Leads = Contatos (Merge UI)

## Metadados
- Data: 2026-03-08
- Status: Implementado
- Impacto: Frontend (paginas CRM)
- Arquivos: leads/page.tsx, leads/[leadId]/page.tsx, crm-sidebar.tsx

## Problema
Leads (CRM Core) e Contatos (Express) eram paginas separadas, mas representam a mesma entidade no contexto do negocio. Usuario queria unificar.

## Opcoes
1. Migrar contatos para CRM Core e usar so leads — complexo, requer migration
2. Mostrar contatos na pagina de leads, manter kanban/groupby com CRM Core — incremental
3. Criar pagina nova unificada — retrabalho desnecessario

## Decisao
**Opcao 2**: A pagina `/crm/leads` usa duas fontes de dados:
- **List view (tabela)**: `contactService.list()` → Express backend `/api/v1/contacts`
- **Kanban/GroupBy**: `crmApi.leads.kanban()` / `crmApi.leads.groupBy()` → CRM Core

## Implementacao

### Pagina de Lista (`/crm/leads`)
- Tabela mostra CONTATOS com colunas: Nome, Telefone, Email, Empresa, Canal, Conversas, Ultima atividade
- Stats, ViewSwitcher, QuickFilters, Search — tudo mantido intacto
- Botao "Novo" abre formulario de criacao de contato (nao stub)
- Click na row → `/crm/leads/{contactId}`
- Query keys: `['contacts-list', params]`

### Pagina de Detalhe (`/crm/leads/[leadId]`)
- Carrega CONTATO via `contactService.getById(id)`
- Abas: Atividade, Dados, Notas, WhatsApp, Messenger, Instagram, iMessage, Booking, Airbnb
- Side panel com campos editaveis (nome, email, empresa, cargo)
- Usa componentes compartilhados: DetailHeader, DetailTabs, SidePanelInfo, ChannelTab

### Sidebar
- Item "Contatos" removido do `sidebarLinkDefs` em `crm-sidebar.tsx`
- Contatos acessiveis somente via pagina Leads
- Pagina `/crm/contacts` ainda existe mas nao linkada

## Contexto
Aplicar quando trabalhar em `/crm/leads`, criacao de contatos, ou navegacao do CRM.
