'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { Conversation, ConversationStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  User,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Tag as TagIcon,
} from 'lucide-react';
import { getInitials, formatDate, formatPhoneNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

interface ContactSidebarProps {
  conversation: Conversation;
}

export function ContactSidebar({ conversation }: ContactSidebarProps) {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: (status: ConversationStatus) =>
      conversationService.update(conversation.id, { status }),
    onSuccess: () => {
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
    onSettled: () => {
      setIsUpdating(false);
    },
  });

  const assignToMeMutation = useMutation({
    mutationFn: () => conversationService.assign(conversation.id, user!.id),
    onSuccess: () => {
      toast.success('Conversa atribuída a você!');
    },
    onError: () => {
      toast.error('Erro ao atribuir conversa');
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => conversationService.close(conversation.id),
    onSuccess: () => {
      toast.success('Conversa fechada!');
    },
    onError: () => {
      toast.error('Erro ao fechar conversa');
    },
  });

  const handleStatusChange = (status: string) => {
    setIsUpdating(true);
    updateStatusMutation.mutate(status as ConversationStatus);
  };

  return (
    <div className="w-80 border-l bg-card overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Contact Info */}
        <div className="text-center space-y-4">
          <Avatar className="h-24 w-24 mx-auto">
            <AvatarFallback className="bg-whatsapp-green text-white text-2xl">
              {getInitials(conversation.contact.name || conversation.contact.phoneNumber)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{conversation.contact.name || 'Sem nome'}</h2>
            <p className="text-sm text-muted-foreground">{formatPhoneNumber(conversation.contact.phoneNumber)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {!conversation.assignedTo && (
            <Button
              onClick={() => assignToMeMutation.mutate()}
              disabled={assignToMeMutation.isPending}
              variant="outline"
              className="w-full"
            >
              <User className="h-4 w-4 mr-2" />
              Atribuir a mim
            </Button>
          )}
          <Button
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending || conversation.status === ConversationStatus.CLOSED}
            variant="outline"
            className="w-full"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Fechar conversa
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={conversation.status}
                  onValueChange={handleStatusChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ConversationStatus.OPEN}>Aberta</SelectItem>
                    <SelectItem value={ConversationStatus.WAITING}>Aguardando</SelectItem>
                    <SelectItem value={ConversationStatus.IN_PROGRESS}>Em Andamento</SelectItem>
                    <SelectItem value={ConversationStatus.CLOSED}>Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Assigned To */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Atribuído a</CardTitle>
              </CardHeader>
              <CardContent>
                {conversation.assignedTo ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(conversation.assignedTo.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{conversation.assignedTo.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não atribuído</p>
                )}
              </CardContent>
            </Card>

            {/* Contact Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Detalhes do Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{formatPhoneNumber(conversation.contact.phoneNumber)}</span>
                </div>
                {conversation.contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{conversation.contact.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Cliente desde {formatDate(conversation.contact.createdAt)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {conversation.tags && conversation.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TagIcon className="h-4 w-4" />
                    Tags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {conversation.tags.map((tag) => (
                      <Badge key={tag.id} style={{ backgroundColor: tag.color }}>
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {conversation.contact.metadata?.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{conversation.contact.metadata.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Histórico de Conversas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>Primeira conversa: {formatDate(conversation.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>Última mensagem: {formatDate(conversation.lastMessageAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
