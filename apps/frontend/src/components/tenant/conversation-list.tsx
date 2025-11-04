'use client';

import { Conversation } from '@/types';
import { ConversationCard } from './conversation-card';

interface ConversationListProps {
  conversations: Conversation[];
  onUpdate: () => void;
}

export function ConversationList({ conversations, onUpdate }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">Nenhuma conversa encontrada</p>
          <p className="text-sm text-muted-foreground">As conversas aparecerão aqui quando houver mensagens</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {conversations.map((conversation) => (
          <ConversationCard key={conversation.id} conversation={conversation} onUpdate={onUpdate} />
        ))}
      </div>
    </div>
  );
}
