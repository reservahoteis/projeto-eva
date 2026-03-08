# CRM Page Layout Pattern

## Metadados
- Confidence: 95%
- Learned from: leads, contacts, deals pages
- Last validated: 2026-03-08
- Category: Frontend Architecture

## Regra
Todas as paginas de listagem CRM seguem este layout padrao com multi-view.

## Estrutura

```
PageHeader (titulo + count badge + refresh + create button)
StatsBar (4x StatsCard com metricas)
ViewControlsBar (search + quick filters + ViewSwitcher list/kanban/groupby)
MainContent
  ├── ListView (tabela com sort, pagination, mobile cards)
  ├── KanbanView (colunas com cards)
  └── GroupByView (buckets colapsaveis)
CreateDialog / EditDialog / DeleteDialog
```

## Componentes Compartilhados CRM

| Componente | Arquivo |
|------------|---------|
| `DetailHeader` | `components/crm/detail-header.tsx` |
| `DetailTabs` | `components/crm/detail-tabs.tsx` |
| `SidePanelInfo` | `components/crm/side-panel-info.tsx` |
| `ActivityTimeline` | `components/crm/activity-timeline.tsx` |
| `ChannelTab` | `components/crm/tabs/index.ts` |
| `NotesTab` | `components/crm/tabs/index.ts` |
| `DataTab` | `components/crm/tabs/index.ts` |

## CSS Variables (Frappe CRM Style)

```
Texto:     --ink-gray-9 (titulo) | -8 (principal) | -6 (secundario) | -5 (label) | -4 (placeholder)
Fundo:     --surface-white | -gray-1 (alternado) | -gray-2 (badges) | -gray-7 (btn primario)
Bordas:    --outline-gray-1 (separadores) | -gray-2 (inputs)
Semantico: --ink-blue-3 (links) | --ink-red-3 (delete) | --surface-blue-2 (bg azul)
```

## Avatar Palette (deterministico por ID)

```typescript
const AVATAR_PALETTE = [
  { bg: '#E6F4FF', text: '#007BE0' },
  { bg: '#E4FAEB', text: '#278F5E' },
  { bg: '#FFF7D3', text: '#DB7706' },
  { bg: '#FFE7E7', text: '#E03636' },
  { bg: '#F3F0FF', text: '#6846E3' },
]
// hash do ID % length para cor
```

## Data Sources Frontend

| Pagina | Source | API |
|--------|--------|-----|
| `/crm/leads` (list) | Express | `contactService` → `/api/v1/contacts` |
| `/crm/leads` (kanban/groupby) | CRM Core | `crmApi.leads` → `/api/v1/leads` |
| `/crm/leads/[id]` | Express | `contactService` → `/api/v1/contacts/:id` |

## Contexto
Aplicar ao criar ou modificar qualquer pagina de listagem no CRM frontend.
