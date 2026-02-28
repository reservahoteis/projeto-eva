'use client'

/**
 * CRM Calendar Page — Espresso Design
 * Placeholder matching Frappe CRM Calendar.vue
 */

import React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { LayoutHeader } from '@/components/crm/layout-header'
import { ViewBreadcrumbs } from '@/components/crm/view-breadcrumbs'

export default function CalendarPage() {
  return (
    <div className="flex flex-col h-full">
      <LayoutHeader
        left={<ViewBreadcrumbs items={[{ label: 'Calendário' }]} />}
      />
      <div className="flex flex-1 flex-col items-center justify-center py-20">
        <CalendarIcon
          className="h-12 w-12 mb-4"
          style={{ color: 'var(--ink-gray-3)' }}
        />
        <p
          className="text-lg font-medium"
          style={{ color: 'var(--ink-gray-5)' }}
        >
          Calendário
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--ink-gray-4)' }}
        >
          Visualize eventos e tarefas em formato de calendário
        </p>
      </div>
    </div>
  )
}
