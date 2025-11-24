import { apiClient } from '@/lib/api-client';
import type { User, UserRole, UserStatus, PaginatedResponse } from '@/types';

interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  avatarUrl?: string;
}

interface UpdateUserData {
  name?: string;
  email?: string;
  role?: UserRole;
  avatarUrl?: string | null;
  password?: string;
}

interface UpdateUserStatusData {
  status: UserStatus;
}

const USER_API_BASE_URL = '/api/users' as const;

class UserService {
  /**
   * Listar usuários com paginação e filtros
   */
  async list(params?: ListUsersParams): Promise<PaginatedResponse<User>> {
    const { data } = await apiClient.get<PaginatedResponse<User>>(
      USER_API_BASE_URL,
      { params }
    );
    return data;
  }

  /**
   * Buscar usuário por ID
   */
  async getById(id: string): Promise<User> {
    const { data } = await apiClient.get<User>(`${USER_API_BASE_URL}/${id}`);
    return data;
  }

  /**
   * Criar novo usuário
   */
  async create(userData: CreateUserData): Promise<User> {
    const { data } = await apiClient.post<User>(USER_API_BASE_URL, userData);
    return data;
  }

  /**
   * Atualizar usuário
   */
  async update(id: string, userData: UpdateUserData): Promise<User> {
    const { data } = await apiClient.patch<User>(
      `${USER_API_BASE_URL}/${id}`,
      userData
    );
    return data;
  }

  /**
   * Atualizar status do usuário (ativar/suspender)
   */
  async updateStatus(id: string, statusData: UpdateUserStatusData): Promise<User> {
    const { data} = await apiClient.patch<User>(
      `${USER_API_BASE_URL}/${id}/status`,
      statusData
    );
    return data;
  }

  /**
   * Deletar usuário
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`${USER_API_BASE_URL}/${id}`);
  }

  /**
   * Obter iniciais do nome
   */
  getInitials(name?: string): string {
    if (!name) return '?';

    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Obter cor do avatar baseada no ID
   */
  getAvatarColor(id: string): string {
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Light Salmon
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2', // Sky Blue
    ];

    // Use first char of ID to pick color
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  }

  /**
   * Traduzir role para português
   */
  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      SUPER_ADMIN: 'Super Admin',
      TENANT_ADMIN: 'Administrador',
      ATTENDANT: 'Atendente',
    };
    return labels[role] || role;
  }

  /**
   * Traduzir status para português
   */
  getStatusLabel(status: UserStatus): string {
    const labels: Record<UserStatus, string> = {
      ACTIVE: 'Ativo',
      INACTIVE: 'Inativo',
      SUSPENDED: 'Suspenso',
    };
    return labels[status] || status;
  }
}

export const userService = new UserService();
