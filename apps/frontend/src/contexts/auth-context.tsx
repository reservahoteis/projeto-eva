'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { User, AuthResponse } from '@/types';
import { authService } from '@/services/auth.service';
import { toast } from 'sonner';

interface AuthContextData {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // 🚀 MODO DEMO - Usuário mock para testar sem backend
  const DEMO_USER: User = {
    id: 'demo-user-id',
    tenantId: 'demo-tenant-id',
    email: 'demo@hotel.com',
    name: 'Demo User',
    role: 'TENANT_ADMIN' as any,
    status: 'ACTIVE' as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const [user, setUser] = useState<User | null>(DEMO_USER); // Login automático!
  const [isLoading, setIsLoading] = useState(false); // Não precisa carregar
  const router = useRouter();

  // Check if user is logged in on mount
  useEffect(() => {
    // MODO DEMO - já está logado automaticamente
    setUser(DEMO_USER);
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response: AuthResponse = await authService.login(email, password);

      // Save tokens
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);

      setUser(response.user);

      toast.success('Login realizado com sucesso!');

      // Redirect based on role
      if (response.user.role === 'SUPER_ADMIN') {
        router.push('/super-admin/tenants');
      } else {
        router.push('/dashboard');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao fazer login';
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    // Clear storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    setUser(null);

    toast.success('Logout realizado com sucesso!');

    // Redirect to login
    router.push('/login');
  };

  const refreshUser = async () => {
    try {
      const currentUser = await authService.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
