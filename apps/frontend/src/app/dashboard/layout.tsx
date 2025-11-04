'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { TenantSidebar } from '@/components/layout/tenant-sidebar';
import { UserRole } from '@/types';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.TENANT_ADMIN, UserRole.ATTENDANT]}>
      <div className="flex h-screen">
        <TenantSidebar />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
