'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { userService } from '@/services/user.service';
import { Conversation, ConversationStatus, UserRole, UserStatus } from '@/types';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  User,
  UserMinus,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  CheckCircle2,
  Tag as TagIcon,
  Users,
  Bot,
  Loader2,
  Archive,
  Trash2,
} from 'lucide-react';
import { cn, getInitials, formatDate, formatPhoneNumber } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

interface ContactSidebarProps {
  conversation: Conversation;
  onIaLockChange?: (locked: boolean) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function ContactSidebar({ conversation, onIaLockChange, onArchive, onDelete }: ContactSidebarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const isAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.TENANT_ADMIN || user?.role === UserRole.HEAD;

  const { data: usersData } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => userService.list({ status: UserStatus.ACTIVE, limit: 100 }),
    enabled: isAdmin,
  });

  const activeUsers = usersData?.data || [];

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

  const assignToUserMutation = useMutation({
    mutationFn: (userId: string) => conversationService.assign(conversation.id, userId),
    onSuccess: () => {
      toast.success('Conversa atribuída com sucesso!');
      setSelectedUserId('');
    },
    onError: () => {
      toast.error('Erro ao atribuir conversa');
    },
  });

  const unassignMutation = useMutation({
    mutationFn: () => conversationService.unassign(conversation.id),
    onSuccess: () => {
      toast.success('Atribuição removida!');
      setSelectedUserId('');
    },
    onError: () => {
      toast.error('Erro ao remover atribuição');
    },
  });

  const handleAssignToUser = (userId: string) => {
    if (userId === 'unassign') {
      unassignMutation.mutate();
    } else if (userId === 'me') {
      assignToMeMutation.mutate();
    } else if (userId) {
      assignToUserMutation.mutate(userId);
    }
  };

  const closeMutation = useMutation({
    mutationFn: () => conversationService.close(conversation.id),
    onSuccess: () => {
      toast.success('Conversa fechada!');
    },
    onError: () => {
      toast.error('Erro ao fechar conversa');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => conversationService.archive(conversation.id),
    onSuccess: () => {
      toast.success('Conversa arquivada!');
      onArchive?.();
    },
    onError: () => {
      toast.error('Erro ao arquivar conversa');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => conversationService.delete(conversation.id),
    onSuccess: () => {
      toast.success('Conversa excluída!');
      onDelete?.();
    },
    onError: () => {
      toast.error('Erro ao excluir conversa');
    },
  });

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja excluir esta conversa? Esta ação não pode ser desfeita.')) {
      deleteMutation.mutate();
    }
  };

  // [FIX] Mutation com optimistic update para evitar race conditions
  // Isso resolve o crash ao clicar rapidamente no toggle de IA
  const toggleIaLockMutation = useMutation({
    mutationFn: ({ id, locked }: { id: string; locked: boolean }) =>
      conversationService.toggleIaLock(id, locked),

    // Optimistic update: atualiza UI ANTES da API responder
    onMutate: async ({ id, locked }) => {
      // Cancela refetches em progresso para evitar race conditions
      await queryClient.cancelQueries({ queryKey: ['conversation', id] });

      // Salva valor anterior para rollback em caso de erro
      const previousConversation = queryClient.getQueryData(['conversation', id]);

      // Atualiza cache otimisticamente (UI responde imediatamente)
      queryClient.setQueryData(['conversation', id], (old: Conversation | undefined) => {
        if (!old) return old; // Safety guard: não atualiza se cache vazio
        return { ...old, iaLocked: locked };
      });

      return { previousConversation };
    },

    // Em caso de erro, faz rollback ao estado anterior
    onError: (err, variables, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(
          ['conversation', variables.id],
          context.previousConversation
        );
      }
      toast.error('Erro ao alterar status da IA');
      console.error('Error toggling IA lock:', err);
    },

    // Sucesso: atualiza com dados reais da API e notifica
    onSuccess: (data, variables) => {
      if (variables.locked) {
        toast.success('IA desativada para esta conversa', {
          description: 'Somente atendentes humanos responderão',
        });
      } else {
        toast.success('IA reativada para esta conversa', {
          description: 'A IA voltará a responder mensagens',
        });
      }

      // Atualiza cache com dados reais (substitui optimistic update)
      if (data) {
        queryClient.setQueryData(['conversation', variables.id], data);
      }

      // Callback opcional do parent (para compatibilidade)
      onIaLockChange?.(variables.locked);
    },
  });

  const handleToggleIaLock = (checked: boolean) => {
    const newLockState = !checked;
    toggleIaLockMutation.mutate({ id: conversation.id, locked: newLockState });
  };

  const handleStatusChange = (status: string) => {
    setIsUpdating(true);
    updateStatusMutation.mutate(status as ConversationStatus);
  };

  return (
    <div className="contact-sidebar w-64 lg:w-72 xl:w-80 h-full overflow-y-auto">
      <div className="p-4 lg:p-5 space-y-4">
        {/* Contact Info - Avatar ao lado do nome */}
        <div className="glass-card-sidebar no-hover">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-white/30">
              <AvatarFallback className="contact-avatar-gradient text-white text-sm font-semibold">
                {getInitials(conversation.contact.name || conversation.contact.phoneNumber)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground truncate">
                {conversation.contact.name || 'Sem nome'}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {formatPhoneNumber(conversation.contact.phoneNumber)}
              </p>
            </div>
          </div>
        </div>

        {/* IA Toggle */}
        <div className="glass-card-sidebar">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl",
                conversation.iaLocked ? "ia-status-inactive" : "ia-status-active"
              )}>
                <Bot className={cn(
                  "h-5 w-5",
                  conversation.iaLocked ? "text-red-500" : "text-green-500"
                )} />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="ia-toggle" className="text-sm font-medium cursor-pointer">
                  Assistente IA
                </Label>
                <span className={cn(
                  "text-xs",
                  conversation.iaLocked ? "text-red-500" : "text-green-500"
                )}>
                  {conversation.iaLocked ? 'Desativada' : 'Ativada'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {toggleIaLockMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                id="ia-toggle"
                checked={!conversation.iaLocked}
                onCheckedChange={handleToggleIaLock}
                disabled={toggleIaLockMutation.isPending}
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-400"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="glass-card-sidebar">
          <div className="space-y-3">
            {isAdmin ? (
              <div className="space-y-2">
                <Select
                  value={selectedUserId}
                  onValueChange={handleAssignToUser}
                  disabled={assignToMeMutation.isPending || assignToUserMutation.isPending || unassignMutation.isPending}
                >
                  <SelectTrigger className="w-full glass-input-sidebar">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <SelectValue placeholder="Atribuir conversa..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {conversation.assignedTo && (
                      <SelectItem value="unassign">
                        <div className="flex items-center gap-2 text-red-400">
                          <UserMinus className="h-4 w-4" />
                          Remover atribuição
                        </div>
                      </SelectItem>
                    )}
                    <SelectItem value="me">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Atribuir a mim
                      </div>
                    </SelectItem>
                    {activeUsers
                      .filter((u) => u.id !== user?.id)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {getInitials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{u.name}</span>
                            <Badge variant="outline" className="text-xs ml-1">
                              {u.role === UserRole.TENANT_ADMIN ? 'Admin' : u.role === UserRole.HEAD ? 'Supervisor' : 'Atendente'}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {conversation.assignedTo && (
                  <p className="text-xs text-muted-foreground text-center">
                    Atribuído a: <span className="font-medium">{conversation.assignedTo.name}</span>
                  </p>
                )}
              </div>
            ) : (
              !conversation.assignedTo && (
                <Button
                  onClick={() => assignToMeMutation.mutate()}
                  disabled={assignToMeMutation.isPending}
                  variant="outline"
                  className="w-full glass-input-sidebar hover:bg-white/20"
                >
                  <User className="h-4 w-4 mr-2" />
                  Atribuir a mim
                </Button>
              )
            )}
            <Button
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending || conversation.status === ConversationStatus.CLOSED}
              variant="outline"
              className="w-full glass-input-sidebar hover:bg-white/20"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Fechar conversa
            </Button>
            <Button
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending || conversation.status === ConversationStatus.ARCHIVED}
              variant="outline"
              className="w-full glass-input-sidebar hover:bg-white/20"
            >
              <Archive className="h-4 w-4 mr-2" />
              Arquivar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              variant="outline"
              className="w-full glass-input-sidebar hover:bg-red-500/10 text-red-600 hover:text-red-700 border-red-200"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir conversa
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="glass-tabs grid w-full grid-cols-2">
            <TabsTrigger value="info" className="glass-tab-trigger">
              Informações
            </TabsTrigger>
            <TabsTrigger value="history" className="glass-tab-trigger">
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 mt-3">
            {/* Status */}
            <div className="glass-card-sidebar compact">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </span>
                <Select
                  value={conversation.status}
                  onValueChange={handleStatusChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="glass-input-sidebar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ConversationStatus.OPEN}>Aberta</SelectItem>
                    <SelectItem value={ConversationStatus.WAITING}>Aguardando</SelectItem>
                    <SelectItem value={ConversationStatus.IN_PROGRESS}>Em Andamento</SelectItem>
                    <SelectItem value={ConversationStatus.CLOSED}>Fechada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Assigned To */}
            <div className="glass-card-sidebar compact">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Atribuído a
                </span>
                {conversation.assignedTo ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/20">
                        {getInitials(conversation.assignedTo.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{conversation.assignedTo.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Não atribuído</p>
                )}
              </div>
            </div>

            {/* Contact Details */}
            <div className="glass-card-sidebar compact">
              <div className="space-y-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Detalhes do Contato
                </span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{formatPhoneNumber(conversation.contact.phoneNumber)}</span>
                  </div>
                  {conversation.contact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{conversation.contact.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Cliente desde {formatDate(conversation.contact.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {conversation.tags && conversation.tags.length > 0 && (
              <div className="glass-card-sidebar compact">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Tags
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {conversation.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        style={{ backgroundColor: tag.color }}
                        className="text-white shadow-sm"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {conversation.contact.metadata?.notes && Array.isArray(conversation.contact.metadata.notes) && conversation.contact.metadata.notes.length > 0 && (
              <div className="glass-card-sidebar compact">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Observações
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {conversation.contact.metadata.notes.map(note => note.content).join('\n')}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-3">
            <div className="glass-card-sidebar compact">
              <div className="space-y-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Histórico de Conversas
                </span>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>Primeira conversa: {formatDate(conversation.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>Última mensagem: {formatDate(conversation.lastMessageAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
