'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '@/services/user.service';
import { Card, CardContent } from '@/components/ui/card';
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

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

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
      return <Badge variant="destructive">Admin</Badge>;
    }
    if (role === UserRole.SUPER_ADMIN) {
      return <Badge className="bg-purple-600">Super Admin</Badge>;
    }
    return <Badge variant="secondary">Atendente</Badge>;
  };

  const getStatusBadge = (status: UserStatus) => {
    if (status === UserStatus.ACTIVE) {
      return <Badge variant="default" className="bg-green-600">Ativo</Badge>;
    }
    if (status === UserStatus.SUSPENDED) {
      return <Badge variant="destructive">Suspenso</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Erro ao carregar usuários</p>
          <Button onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  const users = usersData?.data || [];
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === UserRole.TENANT_ADMIN).length;
  const attendantCount = users.filter((u) => u.role === UserRole.ATTENDANT).length;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-red-100 p-3">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-2xl font-bold">{adminCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atendentes</p>
                <p className="text-2xl font-bold">{attendantCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Nenhum usuário encontrado</p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Usuário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback
                        style={{
                          backgroundColor: userService.getAvatarColor(user.id),
                          color: 'white',
                        }}
                      >
                        {userService.getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{user.name}</h3>
                        {getRoleBadge(user.role)}
                        {getStatusBadge(user.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{user.conversationsCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Conversas</p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o usuário{' '}
              <strong>{deletingUser?.name}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
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
