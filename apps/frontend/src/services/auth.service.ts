import api from '@/lib/axios';
import { AuthResponse, User } from '@/types';

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

/**
 * Authentication service
 */
export const authService = {
  /**
   * Login
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', {
      email,
      password,
    });
    return data;
  },

  /**
   * Register (usado apenas para criar novos usuários dentro de um tenant)
   */
  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', payload);
    return data;
  },

  /**
   * Get current user (me)
   */
  async me(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  /**
   * Refresh token
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  /**
   * Change password
   */
  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await api.post('/auth/change-password', payload);
  },

  /**
   * Logout (clear local tokens)
   */
  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },
};
