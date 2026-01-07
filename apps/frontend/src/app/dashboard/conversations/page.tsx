'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { ConversationStatus } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoardRealtime } from '@/components/tenant/kanban-board-realtime';
import { ConversationList } from '@/components/tenant/conversation-list';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

/**
 * Página de Conversas com Kanban Board
 * Usa KanbanBoardRealtime para atualizações em tempo real via Socket.io
 */
export default function ConversationsPage() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedStatus, setSelectedStatus] = useState<ConversationStatus | 'all'>('all');

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations', selectedStatus],
    queryFn: () => {
      // Filtro "Todas" deve excluir conversas sendo atendidas por bot
      // Apenas mostra conversas que precisam de atenção humana
      // TODO: Backend deve aceitar parâmetro excludeStatus para filtrar BOT_HANDLING
      return conversationService.list({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        limit: 100,
      });
    },
  });

  return (
    <div className="h-screen flex flex-col liquid-bg">
      {/* Header - Clean, no container */}
      <div className="p-4 md:p-6 space-y-3 md:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Conversas</h1>
            <p className="text-sm md:text-base text-[var(--text-muted)]">Gerencie todas as conversas do WhatsApp</p>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={viewMode === 'kanban' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' : 'glass-btn'}
            >
              <LayoutGrid className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Kanban</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white' : 'glass-btn'}
            >
              <List className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Lista</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
          <TabsList className="bg-white/50 backdrop-blur-sm p-1 h-auto flex-wrap w-full sm:w-auto rounded-lg">
            <TabsTrigger value="all" className="text-xs sm:text-sm">Todas</TabsTrigger>
            <TabsTrigger value={ConversationStatus.OPEN} className="text-xs sm:text-sm">Novas</TabsTrigger>
            <TabsTrigger value={ConversationStatus.IN_PROGRESS} className="text-xs sm:text-sm">Em Atendimento</TabsTrigger>
            <TabsTrigger value={ConversationStatus.WAITING} className="text-xs sm:text-sm hidden sm:inline-flex">Aguardando</TabsTrigger>
            <TabsTrigger value={ConversationStatus.CLOSED} className="text-xs sm:text-sm">Finalizadas</TabsTrigger>
            <TabsTrigger value={ConversationStatus.ARCHIVED} className="text-xs sm:text-sm text-gray-500">Arquivadas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          // Skeleton loading - Meta/Google style
          <div className="h-full overflow-x-auto">
            <div className="flex gap-4 p-6 h-full min-w-max">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col w-80 flex-shrink-0">
                  <div className="flex items-center justify-between p-4 bg-card rounded-t-lg border-t-4 border-gray-300 animate-pulse">
                    <div className="h-6 w-32 bg-gray-200 rounded"></div>
                    <div className="h-6 w-8 bg-gray-200 rounded-full"></div>
                  </div>
                  <div className="flex-1 p-2 bg-muted/30 rounded-b-lg space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="bg-white p-4 rounded-lg shadow-sm animate-pulse">
                        <div className="h-4 w-3/4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-full bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 w-2/3 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoardRealtime
            initialConversations={
              // Filtrar conversas BOT_HANDLING e ARCHIVED para não aparecer no Kanban
              (conversations?.data || []).filter(
                conv => conv.status !== ConversationStatus.BOT_HANDLING && conv.status !== ConversationStatus.ARCHIVED
              )
            }
            onUpdate={refetch}
          />
        ) : (
          <ConversationList
            conversations={
              // Na lista, quando "Todas" selecionado, não mostrar BOT_HANDLING e ARCHIVED
              selectedStatus === 'all'
                ? (conversations?.data || []).filter(
                    conv => conv.status !== ConversationStatus.BOT_HANDLING && conv.status !== ConversationStatus.ARCHIVED
                  )
                : (conversations?.data || [])
            }
            onUpdate={refetch}
          />
        )}
      </div>
    </div>
  );
}
