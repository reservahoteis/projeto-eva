import api from '@/lib/axios';
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
    const { data } = await api.get<PaginatedResponse<User>>(
      USER_API_BASE_URL,
      { params }
    );
    return data;
  }

  /**
   * Buscar usuário por ID
   */
  async getById(id: string): Promise<User> {
    const { data } = await api.get<User>(`${USER_API_BASE_URL}/${id}`);
    return data;
  }

  /**
   * Criar novo usuário
   */
  async create(userData: CreateUserData): Promise<User> {
    const { data } = await api.post<User>(USER_API_BASE_URL, userData);
    return data;
  }

  /**
   * Atualizar usuário
   */
  async update(id: string, userData: UpdateUserData): Promise<User> {
    const { data } = await api.patch<User>(
      `${USER_API_BASE_URL}/${id}`,
      userData
    );
    return data;
  }

  /**
   * Atualizar status do usuário (ativar/suspender)
   */
  async updateStatus(id: string, statusData: UpdateUserStatusData): Promise<User> {
    const { data} = await api.patch<User>(
      `${USER_API_BASE_URL}/${id}/status`,
      statusData
    );
    return data;
  }

  /**
   * Deletar usuário
   */
  async delete(id: string): Promise<void> {
    await api.delete(`${USER_API_BASE_URL}/${id}`);
  }

  /**
   * Obter iniciais do nome
   */
  getInitials(name?: string): string {
    if (!name) return '?';

    const parts = name.trim().split(' ');
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];

    if (!firstPart) return '?';

    if (parts.length >= 2 && lastPart) {
      const firstChar = firstPart[0] ?? '';
      const lastChar = lastPart[0] ?? '';
      return (firstChar + lastChar).toUpperCase();
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
    ] as const;

    // Use first char of ID to pick color
    const index = id.charCodeAt(0) % colors.length;
    return colors[index] ?? '#FF6B6B';
  }

  /**
   * Traduzir role para português
   */
  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      SUPER_ADMIN: 'Super Admin',
      TENANT_ADMIN: 'Administrador',
      HEAD: 'Supervisor',
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
