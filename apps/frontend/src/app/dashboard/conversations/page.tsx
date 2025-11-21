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
      const statusesToExclude = [ConversationStatus.BOT_HANDLING];

      return conversationService.list({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        limit: 100,
        // TODO: Backend deve aceitar parâmetro excludeStatus
        // Por ora, filtramos no frontend
      });
    },
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Conversas</h1>
              <p className="text-muted-foreground">Gerencie todas as conversas do WhatsApp</p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 mr-2" />
                Lista
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Tabs value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value={ConversationStatus.OPEN}>Novas</TabsTrigger>
              <TabsTrigger value={ConversationStatus.IN_PROGRESS}>Em Atendimento</TabsTrigger>
              <TabsTrigger value={ConversationStatus.WAITING}>Aguardando Cliente</TabsTrigger>
              <TabsTrigger value={ConversationStatus.CLOSED}>Finalizadas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
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
              // Filtrar conversas BOT_HANDLING para não aparecer no Kanban
              (conversations?.data || []).filter(
                conv => conv.status !== ConversationStatus.BOT_HANDLING
              )
            }
            onUpdate={refetch}
          />
        ) : (
          <ConversationList conversations={conversations?.data || []} onUpdate={refetch} />
        )}
      </div>
    </div>
  );
}
