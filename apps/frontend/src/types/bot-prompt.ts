// Tipos do Dev Prompt Manager — espelham o contrato dos endpoints
// /api/v1/dev/bot-prompts/* e /api/n8n/bot-prompt/by-hotel.
//
// Backend em CamelModel ja entrega tudo em camelCase, entao mapeia 1:1.

export interface BotPromptTenantSummary {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  webCheckinId: string | null;
  activeVersionNumber: number | null;
  activeVersionId: string | null;
  totalVersions: number;
  updatedAt: string | null;
}

export interface BotPromptVersion {
  id: string;
  tenantId: string | null;
  versionNumber: number;
  isActive: boolean;
  isSystemDefault: boolean;
  changeNote: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface BotPromptVersionDetail extends BotPromptVersion {
  templateText: string;
}

export interface RenderedPrompt {
  prompt: string;
  versionNumber: number;
  isSystemDefault: boolean;
  renderedAt: string;
  tenantId: string;
  webCheckinId: string | null;
}

export interface PromptDiff {
  leftLabel: string;
  rightLabel: string;
  leftText: string;
  rightText: string;
  unifiedDiff: string;
}

export type CustomVarType = 'static_global' | 'tenant_field';

export interface CustomVariable {
  id: string;
  varKey: string;
  varType: CustomVarType;
  staticValue: string | null;
  fieldSource: string | null;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FieldSourceOption {
  value: string; // string literal gravada em field_source
  label: string; // texto exibido no dropdown
  hint: string | null;
}

export interface FieldSourceCategory {
  id: string;
  label: string;
  description: string;
  options: FieldSourceOption[];
}

export interface FieldSourcesResponse {
  categories: FieldSourceCategory[];
}

export interface SystemVariable {
  placeholder: string;
  name: string;
  source: string;
  description: string;
  isRuntime: boolean;
}

export interface VariableCatalog {
  systemVariables: SystemVariable[];
  customVariables: CustomVariable[];
}

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  action: string;
  versionId: string | null;
  performedBy: string | null;
  performedAt: string;
  changeSummary: string | null;
  beforeHash: string | null;
  afterHash: string | null;
}

export interface CreateVersionPayload {
  templateText: string;
  changeNote?: string;
  expectedActiveVersion?: number;
}

export interface ActivateVersionPayload {
  expectedActiveVersion?: number;
}

export interface CreateCustomVarPayload {
  varKey: string;
  varType: CustomVarType;
  staticValue?: string;
  fieldSource?: string;
  description?: string;
}

export interface PatchCustomVarPayload {
  staticValue?: string;
  fieldSource?: string;
  description?: string;
}
