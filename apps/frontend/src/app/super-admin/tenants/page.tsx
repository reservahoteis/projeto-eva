'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantService } from '@/services/tenant.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Users, MessageSquare } from 'lucide-react';
import { CreateTenantDialog } from '@/components/super-admin/create-tenant-dialog';
import { TenantStatus } from '@/types';
import { formatDate } from '@/lib/utils';

export default function TenantsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.list(),
  });

  const getStatusBadge = (status: TenantStatus) => {
    const variants = {
      ACTIVE: 'success',
      TRIAL: 'info',
      SUSPENDED: 'warning',
      CANCELLED: 'destructive',
    } as const;

    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Gerencie todos os tenants (hotéis) do sistema</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.pagination.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <Badge variant="success" className="h-5">
              ✓
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data.filter((t) => t.status === 'ACTIVE').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Trial</CardTitle>
            <Badge variant="info" className="h-5">
              T
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data.filter((t) => t.status === 'TRIAL').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
            <Badge variant="warning" className="h-5">
              !
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.data.filter((t) => t.status === 'SUSPENDED').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((tenant) => (
            <Card key={tenant.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{tenant.name}</CardTitle>
                      <CardDescription>@{tenant.slug}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(tenant.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{tenant.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <Badge variant="outline">{tenant.plan}</Badge>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{tenant._count?.users || 0} usuários</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{tenant._count?.conversations || 0} conversas</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      tenant.isWhatsappConnected ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    WhatsApp {tenant.isWhatsappConnected ? 'conectado' : 'não configurado'}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Criado em {formatDate(tenant.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateTenantDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setIsCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
