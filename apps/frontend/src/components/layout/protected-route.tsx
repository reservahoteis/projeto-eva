'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * Protected route component
 * Redirects to login if not authenticated
 * Redirects to unauthorized if wrong role
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // 🚀 MODO DEMO - Desabilitado para testes sem backend
  // Comentei as verificações para você poder navegar livremente

  /*
  useEffect(() => {
    if (!isLoading) {
      // Not authenticated -> redirect to login
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      // Wrong role -> redirect to unauthorized
      if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router]);
  */

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // MODO DEMO - Sempre renderiza os children
  return <>{children}</>;
}
