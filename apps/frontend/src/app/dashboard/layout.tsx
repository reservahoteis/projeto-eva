'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { TenantSidebar } from '@/components/layout/tenant-sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';
import { EscalationNotificationProvider } from '@/components/providers/escalation-notification-provider';
import { UserRole } from '@/types';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.HEAD, UserRole.ATTENDANT, UserRole.SALES]}>
      <EscalationNotificationProvider>
        <div className="flex h-screen">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <TenantSidebar />
          </div>

          {/* Mobile Header */}
          <MobileHeader variant="tenant" />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto bg-background pt-16 lg:pt-0">
            {children}
          </main>
        </div>
      </EscalationNotificationProvider>
    </ProtectedRoute>
  );
}
