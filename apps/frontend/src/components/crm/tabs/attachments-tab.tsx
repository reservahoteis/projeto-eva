'use client'

// Shared Attachments tab — placeholder for future file attachment support.

import { Paperclip } from 'lucide-react'

export function AttachmentsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Paperclip className="w-10 h-10" style={{ color: 'var(--ink-gray-4)' }} />
      <p style={{ color: 'var(--ink-gray-8)', fontSize: '13px', fontWeight: 500 }}>Anexos em breve</p>
      <p style={{ color: 'var(--ink-gray-5)', fontSize: '12px' }}>
        Upload de arquivos sera adicionado em uma versao futura
      </p>
    </div>
  )
}
