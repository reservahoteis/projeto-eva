'use client';

import { MessageSquare } from 'lucide-react';

/**
 * Página de Conversas - Estado Vazio
 *
 * ARQUITETURA SPA-LIKE:
 * - Esta página apenas mostra um estado vazio convidativo
 * - O layout (/conversations/layout.tsx) gerencia a sidebar e navegação
 * - Conversas específicas são carregadas em /conversations/[id]
 * - Nenhuma navegação de página - tudo via Zustand store
 */
export default function ConversationsPage() {
  return (
    <div className="flex-1 flex items-center justify-center h-screen bg-[#f0f2f5]">
      <div className="text-center max-w-md px-4">
        <div className="mb-6 flex justify-center">
          <div className="bg-white rounded-full p-6 shadow-sm">
            <MessageSquare className="h-16 w-16 text-[#00a884]" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-[#111b21] mb-3">
          Selecione uma conversa
        </h2>
        <p className="text-[15px] text-[#667781] leading-relaxed">
          Escolha uma conversa na lista à esquerda para começar a atender seus clientes.
        </p>
        <div className="mt-6 text-xs text-[#8696a0]">
          As conversas são atualizadas em tempo real via WhatsApp
        </div>
      </div>
    </div>
  );
}
