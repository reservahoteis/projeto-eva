import api from '@/lib/axios';
import { Tenant, PaginatedResponse, TenantPlan, TenantStatus } from '@/types';

interface CreateTenantRequest {
  name: string;
  slug: string;
  email: string;
  plan: TenantPlan;
}

interface UpdateTenantRequest {
  name?: string;
  email?: string;
  plan?: TenantPlan;
  status?: TenantStatus;
  maxUsers?: number;
  maxContacts?: number;
}

interface ListTenantsParams {
  page?: number;
  limit?: number;
  status?: TenantStatus;
  search?: string;
}

/**
 * Tenant service (Super Admin only)
 */
export const tenantService = {
  /**
   * List all tenants (Super Admin)
   */
  async list(params?: ListTenantsParams): Promise<PaginatedResponse<Tenant>> {
    const { data } = await api.get<PaginatedResponse<Tenant>>('/api/v1/tenants', {
      params,
    });
    return data;
  },

  /**
   * Get tenant by ID
   */
  async getById(id: string): Promise<Tenant> {
    const { data } = await api.get<Tenant>(`/api/v1/tenants/${id}`);
    return data;
  },

  /**
   * Create new tenant
   */
  async create(payload: CreateTenantRequest): Promise<{
    tenant: Tenant;
    adminUser: {
      id: string;
      email: string;
      name: string;
      role: string;
      temporaryPassword: string;
    };
    tempPassword: string;
    loginUrl: string;
    emailSent: boolean;
  }> {
    const { data } = await api.post('/api/v1/tenants', payload);
    // O backend retorna snake_case: temp_password, email_sent, admin_user
    // Normaliza para camelCase para consumo pelo frontend
    return {
      tenant: data.tenant,
      adminUser: {
        ...(data.admin_user ?? data.adminUser ?? {}),
        temporaryPassword: data.temp_password ?? data.tempPassword ?? '',
      },
      tempPassword: data.temp_password ?? data.tempPassword ?? '',
      loginUrl: data.login_url ?? data.loginUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://hoteisreserva.com.br'}/login`,
      emailSent: data.email_sent ?? data.emailSent ?? false,
    };
  },

  /**
   * Update tenant
   */
  async update(id: string, payload: UpdateTenantRequest): Promise<Tenant> {
    const { data } = await api.patch<Tenant>(`/api/v1/tenants/${id}`, payload);
    return data;
  },

  /**
   * Delete tenant
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/tenants/${id}`);
  },

  /**
   * Get tenant statistics
   */
  async getStats(id: string): Promise<{
    users: number;
    contacts: number;
    conversations: number;
    messages: number;
  }> {
    const { data } = await api.get(`/api/v1/tenants/${id}/stats`);
    return data;
  },
};
