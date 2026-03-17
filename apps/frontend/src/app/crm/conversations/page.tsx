'use client'

import { MessageSquare } from 'lucide-react'

export default function CrmConversationsPage() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center"
      style={{ backgroundColor: 'var(--surface-gray-1)' }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: 'var(--surface-gray-2)' }}
      >
        <MessageSquare
          className="h-8 w-8"
          style={{ color: 'var(--ink-gray-5)' }}
        />
      </div>
      <p
        className="mt-4 text-base font-medium"
        style={{ color: 'var(--ink-gray-5)' }}
      >
        Selecione uma conversa
      </p>
      <p
        className="mt-1 text-sm"
        style={{ color: 'var(--ink-gray-4)' }}
      >
        Escolha uma conversa da lista para começar
      </p>
    </div>
  )
}
