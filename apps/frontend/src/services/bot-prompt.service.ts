import api from '@/lib/axios';
import type {
  ActivateVersionPayload,
  AuditLogEntry,
  BotPromptTenantSummary,
  BotPromptVersion,
  BotPromptVersionDetail,
  CreateCustomVarPayload,
  CreateVersionPayload,
  CustomVariable,
  PatchCustomVarPayload,
  PromptDiff,
  RenderedPrompt,
  VariableCatalog,
} from '@/types/bot-prompt';

const BASE = '/api/v1/dev/bot-prompts';

export const botPromptService = {
  // --- Tenants ---
  async listTenants(): Promise<BotPromptTenantSummary[]> {
    const { data } = await api.get<BotPromptTenantSummary[]>(`${BASE}/tenants`);
    return data;
  },

  // --- System default (read-only) ---
  async getSystemDefault(): Promise<BotPromptVersionDetail> {
    const { data } = await api.get<BotPromptVersionDetail>(`${BASE}/system-default`);
    return data;
  },

  // --- Active version + versoes ---
  async getActive(tenantId: string): Promise<BotPromptVersionDetail> {
    const { data } = await api.get<BotPromptVersionDetail>(`${BASE}/${tenantId}`);
    return data;
  },

  async listVersions(tenantId: string): Promise<BotPromptVersion[]> {
    const { data } = await api.get<BotPromptVersion[]>(`${BASE}/${tenantId}/versions`);
    return data;
  },

  async getVersion(tenantId: string, versionId: string): Promise<BotPromptVersionDetail> {
    const { data } = await api.get<BotPromptVersionDetail>(
      `${BASE}/${tenantId}/versions/${versionId}`,
    );
    return data;
  },

  async createVersion(
    tenantId: string,
    payload: CreateVersionPayload,
  ): Promise<BotPromptVersionDetail> {
    const { data } = await api.post<BotPromptVersionDetail>(
      `${BASE}/${tenantId}/versions`,
      payload,
    );
    return data;
  },

  async activateVersion(
    tenantId: string,
    versionId: string,
    payload: ActivateVersionPayload = {},
  ): Promise<BotPromptVersionDetail> {
    const { data } = await api.post<BotPromptVersionDetail>(
      `${BASE}/${tenantId}/versions/${versionId}/activate`,
      payload,
    );
    return data;
  },

  async resetToDefault(
    tenantId: string,
    payload: ActivateVersionPayload = {},
  ): Promise<BotPromptVersionDetail> {
    const { data } = await api.post<BotPromptVersionDetail>(
      `${BASE}/${tenantId}/reset`,
      payload,
    );
    return data;
  },

  async preview(tenantId: string): Promise<RenderedPrompt> {
    const { data } = await api.get<RenderedPrompt>(`${BASE}/${tenantId}/preview`);
    return data;
  },

  async diff(tenantId: string, against: string = 'default'): Promise<PromptDiff> {
    const { data } = await api.get<PromptDiff>(`${BASE}/${tenantId}/diff`, {
      params: { against },
    });
    return data;
  },

  async listAudit(tenantId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const { data } = await api.get<AuditLogEntry[]>(`${BASE}/${tenantId}/audit`, {
      params: { limit },
    });
    return data;
  },

  // --- Variaveis ---
  async getVariablesCatalog(): Promise<VariableCatalog> {
    const { data } = await api.get<VariableCatalog>(`${BASE}/variables/catalog`);
    return data;
  },

  async listCustomVariables(): Promise<CustomVariable[]> {
    const { data } = await api.get<CustomVariable[]>(`${BASE}/custom-variables`);
    return data;
  },

  async createCustomVariable(payload: CreateCustomVarPayload): Promise<CustomVariable> {
    const { data } = await api.post<CustomVariable>(`${BASE}/custom-variables`, payload);
    return data;
  },

  async updateCustomVariable(
    varId: string,
    payload: PatchCustomVarPayload,
  ): Promise<CustomVariable> {
    const { data } = await api.patch<CustomVariable>(
      `${BASE}/custom-variables/${varId}`,
      payload,
    );
    return data;
  },

  async deleteCustomVariable(varId: string): Promise<void> {
    await api.delete(`${BASE}/custom-variables/${varId}`);
  },
};
