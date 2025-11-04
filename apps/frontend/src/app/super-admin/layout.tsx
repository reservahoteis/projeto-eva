'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { SuperAdminSidebar } from '@/components/layout/super-admin-sidebar';
import { UserRole } from '@/types';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <div className="flex h-screen">
        <SuperAdminSidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto p-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
