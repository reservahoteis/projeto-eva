'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { SuperAdminSidebar } from '@/components/layout/super-admin-sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';
import { UserRole } from '@/types';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <div className="flex h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <SuperAdminSidebar />
        </div>

        {/* Mobile Header */}
        <MobileHeader variant="super-admin" />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background pt-16 lg:pt-0">
          <div className="container mx-auto p-4 md:p-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
