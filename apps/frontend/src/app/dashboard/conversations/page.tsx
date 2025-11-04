'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { ConversationStatus } from '@/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/tenant/kanban-board';
import { ConversationList } from '@/components/tenant/conversation-list';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

export default function ConversationsPage() {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [selectedStatus, setSelectedStatus] = useState<ConversationStatus | 'all'>('all');

  const { data: conversations, isLoading, refetch } = useQuery({
    queryKey: ['conversations', selectedStatus],
    queryFn: () =>
      conversationService.list({
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        limit: 100,
      }),
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
              <TabsTrigger value={ConversationStatus.OPEN}>Abertas</TabsTrigger>
              <TabsTrigger value={ConversationStatus.PENDING}>Pendentes</TabsTrigger>
              <TabsTrigger value={ConversationStatus.IN_PROGRESS}>Em Andamento</TabsTrigger>
              <TabsTrigger value={ConversationStatus.RESOLVED}>Resolvidas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard conversations={conversations?.data || []} onUpdate={refetch} />
        ) : (
          <ConversationList conversations={conversations?.data || []} onUpdate={refetch} />
        )}
      </div>
    </div>
  );
}
