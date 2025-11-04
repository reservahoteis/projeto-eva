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
    const { data } = await api.get<PaginatedResponse<Tenant>>('/api/tenants', {
      params,
    });
    return data;
  },

  /**
   * Get tenant by ID
   */
  async getById(id: string): Promise<Tenant> {
    const { data } = await api.get<Tenant>(`/api/tenants/${id}`);
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
      temporaryPassword: string;
    };
    loginUrl: string;
  }> {
    const { data } = await api.post('/api/tenants', payload);
    return data;
  },

  /**
   * Update tenant
   */
  async update(id: string, payload: UpdateTenantRequest): Promise<Tenant> {
    const { data } = await api.patch<Tenant>(`/api/tenants/${id}`, payload);
    return data;
  },

  /**
   * Delete tenant
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/tenants/${id}`);
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
    const { data } = await api.get(`/api/tenants/${id}/stats`);
    return data;
  },
};
