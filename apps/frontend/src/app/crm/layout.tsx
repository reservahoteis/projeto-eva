'use client'

import './crm.css'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { CrmSidebar } from '@/components/crm/crm-sidebar'
import { UserRole } from '@/types'

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.SUPER_ADMIN,
        UserRole.TENANT_ADMIN,
        UserRole.HEAD,
        UserRole.ATTENDANT,
        UserRole.SALES,
      ]}
    >
      {/* Faithful to Frappe CRM DesktopLayout.vue */}
      <div className="crm-app flex h-screen w-screen">
        <div className="h-full border-r" style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-menu-bar)' }}>
          <CrmSidebar />
        </div>
        <div className="flex flex-1 flex-col h-full overflow-auto" style={{ backgroundColor: 'var(--surface-white)' }}>
          {/* AppHeader teleport target */}
          <div id="crm-header" />
          {children}
        </div>
      </div>
    </ProtectedRoute>
  )
}
