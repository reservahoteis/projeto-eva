'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Users, Shield, UserCheck, RefreshCw } from 'lucide-react';
import { UserRole, UserStatus, type User } from '@/types';
import { toast } from 'sonner';
import { UserForm } from '@/components/tenant/user-form';
import { ResetPasswordForm } from '@/components/tenant/reset-password-form';
import { ProtectedRoute } from '@/components/layout/protected-route';

function UsersPageContent() {
  const queryClient = useQueryClient();
  const [page, _setPage] = useState(1); // TODO: Implement pagination UI

  // Estados dos dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Query para listar usuários
  const { data: usersData, isLoading, error, refetch } = useQuery({
    queryKey: ['users', page],
    queryFn: () => userService.list({ page, limit: 50 }),
  });

  // Mutation para criar usuário
  const createMutation = useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      toast.success('Usuário criado com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao criar usuário';
      toast.error(message);
    },
  });

  // Mutation para atualizar usuário
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      userService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      toast.success('Usuário atualizado com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar usuário';
      toast.error(message);
    },
  });

  // Mutation para redefinir senha
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      userService.update(id, { password }),
    onSuccess: () => {
      setResetPasswordUser(null);
      toast.success('Senha redefinida com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao redefinir senha';
      toast.error(message);
    },
  });

  // Mutation para atualizar status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      userService.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar status';
      toast.error(message);
    },
  });

  // Mutation para deletar usuário
  const deleteMutation = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeletingUser(null);
      toast.success('Usuário removido com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao remover usuário';
      toast.error(message);
    },
  });

  // Handlers
  const handleCreateUser = async (data: any) => {
    await createMutation.mutateAsync(data);
  };

  const handleUpdateUser = async (data: any) => {
    if (!editingUser) return;
    await updateMutation.mutateAsync({ id: editingUser.id, data });
  };

  const handleResetPassword = async (password: string) => {
    if (!resetPasswordUser) return;
    await resetPasswordMutation.mutateAsync({ id: resetPasswordUser.id, password });
  };

  const handleToggleStatus = (user: User) => {
    const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
    updateStatusMutation.mutate({ id: user.id, status: newStatus });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    await deleteMutation.mutateAsync(deletingUser.id);
  };

  const getRoleBadge = (role: UserRole) => {
    if (role === UserRole.TENANT_ADMIN) {
      return <Badge className="bg-gradient-to-r from-rose-500 to-red-600 text-white border-0">Admin</Badge>;
    }
    if (role === UserRole.SUPER_ADMIN) {
      return <Badge className="bg-gradient-to-r from-purple-500 to-violet-600 text-white border-0">Super Admin</Badge>;
    }
    if (role === UserRole.HEAD) {
      return <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">Supervisor</Badge>;
    }
    return <Badge variant="secondary">Atendente</Badge>;
  };

  const getStatusBadge = (status: UserStatus) => {
    if (status === UserStatus.ACTIVE) {
      return <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0">Ativo</Badge>;
    }
    if (status === UserStatus.SUSPENDED) {
      return <Badge className="bg-gradient-to-r from-rose-500 to-red-600 text-white border-0">Suspenso</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 md:h-10 w-40 md:w-48 mb-2" />
            <Skeleton className="h-4 md:h-5 w-48 md:w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
        <div className="text-center py-12">
          <p className="text-[var(--text-muted)] mb-4">Erro ao carregar usuários</p>
          <Button onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const users = usersData?.data || [];
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === UserRole.TENANT_ADMIN).length;
  const headCount = users.filter((u) => u.role === UserRole.HEAD).length;
  const attendantCount = users.filter((u) => u.role === UserRole.ATTENDANT).length;

  const statsCards = [
    {
      title: 'TOTAL DE USUÁRIOS',
      value: totalUsers,
      icon: Users,
      iconBoxClass: 'icon-box icon-box-blue',
    },
    {
      title: 'ADMINISTRADORES',
      value: adminCount,
      icon: Shield,
      iconBoxClass: 'icon-box icon-box-rose',
    },
    {
      title: 'SUPERVISORES',
      value: headCount,
      icon: UserCheck,
      iconBoxClass: 'icon-box icon-box-amber',
    },
    {
      title: 'ATENDENTES',
      value: attendantCount,
      icon: UserCheck,
      iconBoxClass: 'icon-box icon-box-green',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Usuários</h1>
          <p className="text-sm md:text-base text-[var(--text-muted)]">Gerencie os usuários do sistema</p>
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
          <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Novo Usuário</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
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

      {/* User List */}
      {users.length === 0 ? (
        <div className="glass-card p-12 text-center animate-slideUp" style={{ animationDelay: '0.3s' }}>
          <p className="text-[var(--text-muted)] mb-4">Nenhum usuário encontrado</p>
          <Button onClick={() => setIsCreateOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeiro Usuário
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user, index) => (
            <div
              key={user.id}
              className="glass-card glass-kpi p-6 animate-slideUp"
              style={{ animationDelay: `${(index + 3) * 0.05}s` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shadow-lg flex-shrink-0">
                    <AvatarFallback
                      style={{
                        background: `linear-gradient(135deg, ${userService.getAvatarColor(user.id)} 0%, ${userService.getAvatarColor(user.id + '1')} 100%)`,
                        color: 'white',
                      }}
                    >
                      {userService.getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <h3 className="font-semibold text-[var(--text-primary)] truncate">{user.name}</h3>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user.status)}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pl-13 sm:pl-0">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{(user as any).conversationsCount || 0}</p>
                    <p className="text-xs text-[var(--text-muted)]">Conversas</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-card border-[var(--glass-border)]">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setEditingUser(user)}>
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setResetPasswordUser(user)}>
                        Redefinir senha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                        {user.status === UserStatus.ACTIVE ? 'Suspender' : 'Ativar'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingUser(user)}
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Novo Usuário</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Crie um novo usuário para o sistema
            </DialogDescription>
          </DialogHeader>
          <UserForm
            onSubmit={handleCreateUser}
            onCancel={() => setIsCreateOpen(false)}
            isLoading={createMutation.isPending}
            submitLabel="Criar Usuário"
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Editar Usuário</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <UserForm
              user={editingUser}
              onSubmit={handleUpdateUser}
              onCancel={() => setEditingUser(null)}
              isLoading={updateMutation.isPending}
              submitLabel="Salvar Alterações"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de redefinir senha */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <DialogContent className="max-w-md glass-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Redefinir Senha</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Digite a nova senha para o usuário
            </DialogDescription>
          </DialogHeader>
          {resetPasswordUser && (
            <ResetPasswordForm
              userName={resetPasswordUser.name}
              onSubmit={handleResetPassword}
              onCancel={() => setResetPasswordUser(null)}
              isLoading={resetPasswordMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Alert de confirmação de delete */}
      <AlertDialog
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--text-primary)]">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--text-muted)]">
              Tem certeza que deseja remover o usuário{' '}
              <strong>{deletingUser?.name}</strong>?
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

// Wrap with ProtectedRoute - HEAD não pode acessar esta página
export default function UsersPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <UsersPageContent />
    </ProtectedRoute>
  );
}
