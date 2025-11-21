'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useMutation } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { Conversation, ConversationStatus, Message } from '@/types';
import { ConversationCard } from './conversation-card';
import { useSocketContext } from '@/contexts/socket-context';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface KanbanBoardRealtimeProps {
  initialConversations: Conversation[];
  onUpdate: () => void;
}

/**
 * Colunas do Kanban - Sincronizadas com backend Prisma schema
 * Não inclui BOT_HANDLING pois essas conversas não aparecem no Kanban
 */
const columns = [
  { id: ConversationStatus.OPEN, title: 'Novas', color: 'border-yellow-500' },
  { id: ConversationStatus.IN_PROGRESS, title: 'Em Atendimento', color: 'border-blue-500' },
  { id: ConversationStatus.WAITING, title: 'Aguardando Cliente', color: 'border-orange-500' },
  { id: ConversationStatus.CLOSED, title: 'Finalizadas', color: 'border-green-500' },
] as const;

export function KanbanBoardRealtime({ initialConversations, onUpdate }: KanbanBoardRealtimeProps) {
  const [conversations, setConversations] = useState(initialConversations);
  const { on, off, isConnected } = useSocketContext();

  // Update conversations when initial data changes
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!isConnected) return;

    // Handle new message - update conversation
    const handleNewMessage = ({ message, conversation }: { message: Message; conversation: Conversation }) => {
      setConversations((prev) => {
        const updated = prev.map((conv) => {
          if (conv.id === conversation.id) {
            return {
              ...conv,
              lastMessage: message,
              lastMessageAt: message.createdAt,
              unreadCount: message.direction === 'INBOUND' ? conv.unreadCount + 1 : conv.unreadCount,
            };
          }
          return conv;
        });

        // If conversation is new, add it to the list
        const exists = prev.find((conv) => conv.id === conversation.id);
        if (!exists) {
          return [conversation, ...updated];
        }

        return updated;
      });
    };

    // Handle conversation status update
    const handleConversationUpdate = ({ conversation }: { conversation: Conversation }) => {
      setConversations((prev) =>
        prev.map((conv) => (conv.id === conversation.id ? conversation : conv))
      );
    };

    // Handle conversation assignment
    const handleConversationAssign = ({ conversationId, user }: { conversationId: string; user: any }) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, assignedTo: user, assignedToId: user?.id }
            : conv
        )
      );
    };

    on('message:new', handleNewMessage);
    on('conversation:update', handleConversationUpdate);
    on('conversation:assign', handleConversationAssign);

    // Cleanup
    return () => {
      off('message:new', handleNewMessage);
      off('conversation:update', handleConversationUpdate);
      off('conversation:assign', handleConversationAssign);
    };
  }, [isConnected, on, off]);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConversationStatus }) =>
      conversationService.update(id, { status }),
    retry: 3, // Retry até 3 vezes
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    onSuccess: (_, variables) => {
      const statusLabels = {
        [ConversationStatus.OPEN]: 'Novas',
        [ConversationStatus.IN_PROGRESS]: 'Em Atendimento',
        [ConversationStatus.WAITING]: 'Aguardando Cliente',
        [ConversationStatus.CLOSED]: 'Finalizadas',
        [ConversationStatus.BOT_HANDLING]: 'Bot',
      };
      toast.success(`Conversa movida para "${statusLabels[variables.status]}"`);
      onUpdate();
    },
    onError: (error: any, variables) => {
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      toast.error(`Falha ao atualizar conversa: ${errorMessage}`, {
        duration: 5000,
        action: {
          label: 'Tentar novamente',
          onClick: () => updateMutation.mutate(variables),
        },
      });
      // Rollback optimistic update
      setConversations(initialConversations);
      console.error('Kanban real-time update error:', { error, variables });
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside the list
    if (!destination) {
      return;
    }

    // Dropped in same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Type-safe validation: ensure destination is a valid ConversationStatus
    const validStatuses: readonly string[] = [
      ConversationStatus.OPEN,
      ConversationStatus.IN_PROGRESS,
      ConversationStatus.WAITING,
      ConversationStatus.CLOSED,
    ];

    if (!validStatuses.includes(destination.droppableId)) {
      console.error('Invalid destination status:', destination.droppableId);
      toast.error('Status de destino inválido');
      return;
    }

    const newStatus = destination.droppableId as ConversationStatus;

    // Optimistic update
    const updated = conversations.map((conv) =>
      conv.id === draggableId ? { ...conv, status: newStatus } : conv
    );
    setConversations(updated);

    // Server update with retry
    updateMutation.mutate({ id: draggableId, status: newStatus });
  };

  const getConversationsForColumn = (status: ConversationStatus) => {
    return conversations.filter((conv) => conv.status === status);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-full overflow-x-auto" role="main" aria-label="Kanban board de conversas">
        {/* Connection Status Indicator */}
        {!isConnected && (
          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4"
            role="alert"
            aria-live="polite"
          >
            <p className="font-medium">Modo offline</p>
            <p className="text-sm">Atualizações em tempo real temporariamente indisponíveis</p>
          </div>
        )}

        <div className="flex gap-4 p-6 h-full min-w-max" role="region" aria-label="Colunas do Kanban">
          {columns.map((column) => {
            const columnConversations = getConversationsForColumn(column.id);

            return (
              <div
                key={column.id}
                className="flex flex-col w-80 flex-shrink-0"
                role="region"
                aria-label={`Coluna ${column.title}`}
              >
                {/* Column Header */}
                <div
                  className={cn(
                    'flex items-center justify-between p-4 bg-card rounded-t-lg border-t-4',
                    column.color
                  )}
                >
                  <h3 className="font-semibold" id={`column-${column.id}`}>{column.title}</h3>
                  <span
                    className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full"
                    aria-label={`${columnConversations.length} conversas nesta coluna`}
                  >
                    {columnConversations.length}
                  </span>
                </div>

                {/* Droppable Column */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'flex-1 p-2 bg-muted/30 rounded-b-lg space-y-2 overflow-y-auto min-h-[200px]',
                        snapshot.isDraggingOver && 'bg-accent/50'
                      )}
                      aria-labelledby={`column-${column.id}`}
                      aria-describedby={snapshot.isDraggingOver ? `dropping-in-${column.id}` : undefined}
                    >
                      {columnConversations.map((conversation, index) => (
                        <Draggable key={conversation.id} draggableId={conversation.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(snapshot.isDragging && 'opacity-50')}
                              aria-label={`Conversa com ${conversation.contact?.name || conversation.contact?.phone || 'contato'}`}
                            >
                              <ConversationCard conversation={conversation} onUpdate={onUpdate} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {columnConversations.length === 0 && (
                        <div
                          className="flex items-center justify-center h-32 text-sm text-muted-foreground"
                          aria-live="polite"
                        >
                          Nenhuma conversa
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}