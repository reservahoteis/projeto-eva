'use client'

// Shared Emails tab — placeholder for future email integration.

import { Mail } from 'lucide-react'

export function EmailsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Mail className="w-10 h-10" style={{ color: 'var(--ink-gray-4)' }} />
      <p style={{ color: 'var(--ink-gray-8)', fontSize: '13px', fontWeight: 500 }}>Emails em breve</p>
      <p style={{ color: 'var(--ink-gray-5)', fontSize: '12px' }}>
        Integracao de emails sera adicionada em uma versao futura
      </p>
    </div>
  )
}
