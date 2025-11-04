'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useMutation } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { Conversation, ConversationStatus } from '@/types';
import { ConversationCard } from './conversation-card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  conversations: Conversation[];
  onUpdate: () => void;
}

const columns = [
  { id: ConversationStatus.OPEN, title: 'Abertas', color: 'border-yellow-500' },
  { id: ConversationStatus.PENDING, title: 'Pendentes', color: 'border-orange-500' },
  { id: ConversationStatus.IN_PROGRESS, title: 'Em Andamento', color: 'border-blue-500' },
  { id: ConversationStatus.RESOLVED, title: 'Resolvidas', color: 'border-green-500' },
];

export function KanbanBoard({ conversations, onUpdate }: KanbanBoardProps) {
  const [optimisticConversations, setOptimisticConversations] = useState(conversations);

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ConversationStatus }) =>
      conversationService.update(id, { status }),
    onSuccess: () => {
      toast.success('Conversa atualizada com sucesso!');
      onUpdate();
    },
    onError: () => {
      toast.error('Erro ao atualizar conversa');
      setOptimisticConversations(conversations);
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

    const newStatus = destination.droppableId as ConversationStatus;

    // Optimistic update
    const updated = optimisticConversations.map((conv) =>
      conv.id === draggableId ? { ...conv, status: newStatus } : conv
    );
    setOptimisticConversations(updated);

    // Server update
    updateMutation.mutate({ id: draggableId, status: newStatus });
  };

  const getConversationsForColumn = (status: ConversationStatus) => {
    return optimisticConversations.filter((conv) => conv.status === status);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-full overflow-x-auto">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {columns.map((column) => {
            const columnConversations = getConversationsForColumn(column.id);

            return (
              <div key={column.id} className="flex flex-col w-80 flex-shrink-0">
                {/* Column Header */}
                <div
                  className={cn(
                    'flex items-center justify-between p-4 bg-card rounded-t-lg border-t-4',
                    column.color
                  )}
                >
                  <h3 className="font-semibold">{column.title}</h3>
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
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
                    >
                      {columnConversations.map((conversation, index) => (
                        <Draggable key={conversation.id} draggableId={conversation.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(snapshot.isDragging && 'opacity-50')}
                            >
                              <ConversationCard conversation={conversation} onUpdate={onUpdate} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {columnConversations.length === 0 && (
                        <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
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
