'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { contactService } from '@/services/contact.service';
import { useSocketContext } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactForm } from '@/components/tenant/contact-form';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash,
  Phone,
  Mail,
  MessageSquare,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Contact } from '@/types';

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const socket = useSocketContext();

  // Estados locais
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  // Debounce da busca
  const debouncedSearch = useDebounce(searchTerm, 500);

  // Query para listar contatos
  const { data: contactsData, isLoading, error, refetch } = useQuery({
    queryKey: ['contacts', currentPage, debouncedSearch],
    queryFn: () =>
      contactService.list({
        page: currentPage,
        limit: 20,
        search: debouncedSearch || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    keepPreviousData: true,
  });

  // Query para estatísticas
  const { data: stats } = useQuery({
    queryKey: ['contact-stats'],
    queryFn: () => contactService.getStats(),
    refetchInterval: 60000,
  });

  // Mutation para criar contato
  const createMutation = useMutation({
    mutationFn: contactService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contact-stats']);
      setIsCreateOpen(false);
      toast.success('Contato criado com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao criar contato';
      toast.error(message);
    },
  });

  // Mutation para atualizar contato
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      contactService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      setEditingContact(null);
      toast.success('Contato atualizado com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar contato';
      toast.error(message);
    },
  });

  // Mutation para deletar contato
  const deleteMutation = useMutation({
    mutationFn: contactService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contact-stats']);
      setDeletingContact(null);
      toast.success('Contato removido com sucesso!');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao remover contato';
      toast.error(message);
    },
  });

  // Socket.io listeners
  useEffect(() => {
    if (!socket) return;

    const handleContactCreated = ({ contact }: { contact: Contact }) => {
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contact-stats']);
      toast.info(`Novo contato: ${contact.name || contact.phoneNumber}`);
    };

    const handleContactUpdated = ({ contact }: { contact: Contact }) => {
      queryClient.setQueryData(
        ['contacts', currentPage, debouncedSearch],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((c: Contact) =>
              c.id === contact.id ? contact : c
            ),
          };
        }
      );
    };

    const handleContactDeleted = ({ contactId }: { contactId: string }) => {
      queryClient.setQueryData(
        ['contacts', currentPage, debouncedSearch],
        (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.filter((c: Contact) => c.id !== contactId),
            total: oldData.total - 1,
          };
        }
      );
      queryClient.invalidateQueries(['contact-stats']);
    };

    socket.on('contact:created', handleContactCreated);
    socket.on('contact:updated', handleContactUpdated);
    socket.on('contact:deleted', handleContactDeleted);

    return () => {
      socket.off('contact:created', handleContactCreated);
      socket.off('contact:updated', handleContactUpdated);
      socket.off('contact:deleted', handleContactDeleted);
    };
  }, [socket, queryClient, currentPage, debouncedSearch]);

  // Handlers
  const handleCreateContact = async (data: any) => {
    const metadata = data.notes ? { notes: data.notes } : undefined;
    await createMutation.mutateAsync({
      phoneNumber: data.phoneNumber,
      name: data.name,
      email: data.email,
      profilePictureUrl: data.profilePictureUrl,
      metadata,
    });
  };

  const handleUpdateContact = async (data: any) => {
    if (!editingContact) return;

    const metadata = data.notes ? { notes: data.notes } : null;
    await updateMutation.mutateAsync({
      id: editingContact.id,
      data: {
        name: data.name || undefined,
        email: data.email || undefined,
        profilePictureUrl: data.profilePictureUrl || null,
        metadata,
      },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContact) return;
    await deleteMutation.mutateAsync(deletingContact.id);
  };

  // Componente de Skeleton para loading
  const ContactsSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
      ))}
    </div>
  );

  const statsCards = [
    {
      title: 'TOTAL DE CONTATOS',
      value: stats?.total || 0,
      icon: Users,
      iconBoxClass: 'icon-box icon-box-blue',
    },
    {
      title: 'COM CONVERSAS',
      value: stats?.withConversations || 0,
      icon: UserCheck,
      iconBoxClass: 'icon-box icon-box-green',
    },
    {
      title: 'SEM CONVERSAS',
      value: stats?.withoutConversations || 0,
      icon: UserX,
      iconBoxClass: 'icon-box icon-box-orange',
    },
    {
      title: 'ADICIONADOS HOJE',
      value: stats?.recentContacts?.filter(
        (c) => new Date(c.createdAt).toDateString() === new Date().toDateString()
      ).length || 0,
      icon: Plus,
      iconBoxClass: 'icon-box icon-box-purple',
    },
  ];

  // Renderização
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Contatos</h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">Gerencie os contatos do seu WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            className="glass-btn"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled
            className="glass-btn hidden sm:flex"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled
            className="glass-btn hidden sm:flex"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo Contato</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="glass-card glass-kpi p-6 animate-slideUp"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider mb-2">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">
                    {stat.value}
                  </p>
                </div>
                <div className={stat.iconBoxClass}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card principal */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.4s' }}>
        {/* Barra de busca */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[var(--text-muted)] h-4 w-4" />
            <Input
              type="search"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="glass-input pl-12 h-12"
            />
          </div>
        </div>

        {/* Lista de contatos */}
        {isLoading ? (
          <ContactsSkeleton />
        ) : error ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <p>Erro ao carregar contatos</p>
            <Button variant="link" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : !contactsData?.data.length ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            {debouncedSearch ? (
              <p>Nenhum contato encontrado para "{debouncedSearch}"</p>
            ) : (
              <>
                <p>Nenhum contato cadastrado ainda</p>
                <Button
                  variant="link"
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-2"
                >
                  Adicionar primeiro contato
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-3">
              {contactsData.data.map((contact) => (
                <div key={contact.id} className="p-4 rounded-ios-xs border border-[var(--glass-border)] bg-[var(--glass-bg-hover)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarImage src={contact.profilePictureUrl} />
                        <AvatarFallback
                          style={{
                            backgroundColor: contactService.getAvatarColor(contact.id),
                          }}
                        >
                          {contactService.getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {contact.name || 'Sem nome'}
                        </p>
                        <p className="text-sm text-[var(--text-muted)] font-mono">
                          {contactService.formatPhoneNumber(contact.phoneNumber)}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-card border-[var(--glass-border)]">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeletingContact(contact)}
                          disabled={
                            (contact.conversationsCount ||
                             contact._count?.conversations || 0) > 0
                          }
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--glass-border)]">
                    <Badge variant="secondary" className="gap-1 bg-[var(--glass-bg-strong)]">
                      <MessageSquare className="h-3 w-3" />
                      {contact.conversationsCount || contact._count?.conversations || 0} conversas
                    </Badge>
                    <span className="text-xs text-[var(--text-muted)]">
                      {contact.lastConversationAt
                        ? formatDistanceToNow(new Date(contact.lastConversationAt), { addSuffix: true, locale: ptBR })
                        : 'Nunca'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block rounded-ios-xs overflow-hidden border border-[var(--glass-border)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[var(--glass-bg-hover)]">
                    <TableHead className="text-[var(--text-secondary)]">Contato</TableHead>
                    <TableHead className="text-[var(--text-secondary)]">Telefone</TableHead>
                    <TableHead className="text-[var(--text-secondary)] hidden lg:table-cell">Email</TableHead>
                    <TableHead className="text-[var(--text-secondary)]">Conversas</TableHead>
                    <TableHead className="text-[var(--text-secondary)] hidden lg:table-cell">Última Interação</TableHead>
                    <TableHead className="text-right text-[var(--text-secondary)]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contactsData.data.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={contact.profilePictureUrl} />
                            <AvatarFallback
                              style={{
                                backgroundColor: contactService.getAvatarColor(contact.id),
                              }}
                            >
                              {contactService.getInitials(contact.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">
                              {contact.name || 'Sem nome'}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                              ID: {contact.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-[var(--text-muted)]" />
                          <span className="font-mono text-sm text-[var(--text-secondary)]">
                            {contactService.formatPhoneNumber(contact.phoneNumber)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {contact.email ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-[var(--text-muted)]" />
                            <span className="text-sm text-[var(--text-secondary)]">{contact.email}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 bg-[var(--glass-bg-strong)]">
                          <MessageSquare className="h-3 w-3" />
                          {contact.conversationsCount || contact._count?.conversations || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {contact.lastConversationAt ? (
                          <span className="text-sm text-[var(--text-muted)]">
                            {formatDistanceToNow(
                              new Date(contact.lastConversationAt),
                              { addSuffix: true, locale: ptBR }
                            )}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">Nunca</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass-card border-[var(--glass-border)]">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeletingContact(contact)}
                              disabled={
                                (contact.conversationsCount ||
                                 contact._count?.conversations || 0) > 0
                              }
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Paginação */}
        {contactsData && contactsData.pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-[var(--text-muted)]">
              Mostrando {contactsData.data.length} de {contactsData.total} contatos
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="glass-btn"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === contactsData.pagination.pages}
                className="glass-btn"
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Novo Contato</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Adicione um novo contato ao sistema
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            onSubmit={handleCreateContact}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isLoading}
            submitLabel="Criar Contato"
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
      >
        <DialogContent className="max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Editar Contato</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Atualize as informações do contato
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            contact={editingContact}
            onSubmit={handleUpdateContact}
            onCancel={() => setEditingContact(null)}
            isLoading={updateMutation.isLoading}
            submitLabel="Salvar Alterações"
          />
        </DialogContent>
      </Dialog>

      {/* Alert de confirmação de delete */}
      <AlertDialog
        open={!!deletingContact}
        onOpenChange={(open) => !open && setDeletingContact(null)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--text-primary)]">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Tem certeza que deseja remover o contato{' '}
              <strong>{deletingContact?.name || deletingContact?.phoneNumber}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="glass-btn">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
