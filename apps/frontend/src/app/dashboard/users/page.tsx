'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreVertical, Users, Shield, UserCheck } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { UserRole, UserStatus } from '@/types';

export default function UsersPage() {
  // Mock data - will be replaced with real API calls
  const users = [
    {
      id: '1',
      name: 'Carlos Administrador',
      email: 'admin@hotel.com',
      role: UserRole.TENANT_ADMIN,
      status: UserStatus.ACTIVE,
      conversationsCount: 0,
    },
    {
      id: '2',
      name: 'Ana Atendente',
      email: 'ana@hotel.com',
      role: UserRole.ATTENDANT,
      status: UserStatus.ACTIVE,
      conversationsCount: 15,
    },
    {
      id: '3',
      name: 'Pedro Atendente',
      email: 'pedro@hotel.com',
      role: UserRole.ATTENDANT,
      status: UserStatus.ACTIVE,
      conversationsCount: 12,
    },
  ];

  const getRoleBadge = (role: UserRole) => {
    if (role === UserRole.TENANT_ADMIN) {
      return <Badge variant="destructive">Admin</Badge>;
    }
    return <Badge variant="secondary">Atendente</Badge>;
  };

  const getStatusBadge = (status: UserStatus) => {
    if (status === UserStatus.ACTIVE) {
      return <Badge variant="success">Ativo</Badge>;
    }
    if (status === UserStatus.SUSPENDED) {
      return <Badge variant="warning">Suspenso</Badge>;
    }
    return <Badge variant="secondary">Inativo</Badge>;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
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
                <p className="text-2xl font-bold">{users.length}</p>
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
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === UserRole.TENANT_ADMIN).length}
                </p>
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
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.role === UserRole.ATTENDANT).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      <div className="space-y-4">
        {users.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user.name)}
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
                    <p className="text-2xl font-bold">{user.conversationsCount}</p>
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
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Redefinir senha</DropdownMenuItem>
                      {user.status === UserStatus.ACTIVE ? (
                        <DropdownMenuItem className="text-destructive">Suspender</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem>Ativar</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
