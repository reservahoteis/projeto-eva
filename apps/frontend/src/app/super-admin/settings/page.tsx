'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantService } from '@/services/tenant.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, Shield, Globe, Activity } from 'lucide-react';

export default function SuperAdminSettingsPage() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.list(),
  });

  const tenantList = tenants?.data || [];
  const totalTenants = tenantList.length;
  const activeTenants = tenantList.filter((t) => t.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Configurações globais da plataforma</p>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Informações do Sistema</CardTitle>
              <CardDescription>Status e versão da plataforma</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Versão</p>
              <p className="font-medium">1.0.0</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Ambiente</p>
              <Badge variant="default">Produção</Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">API</p>
              <p className="font-medium text-sm">api.botreserva.com.br</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Backend</p>
              <p className="font-medium text-sm">Express + TypeScript + Prisma</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Database</p>
              <p className="font-medium text-sm">PostgreSQL 16</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Cache</p>
              <p className="font-medium text-sm">Redis + BullMQ</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Estatísticas da Plataforma</CardTitle>
              <CardDescription>Visão geral dos tenants</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-3xl font-bold">{totalTenants}</p>
                <p className="text-sm text-muted-foreground">Total de Tenants</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-3xl font-bold text-green-600">{activeTenants}</p>
                <p className="text-sm text-muted-foreground">Tenants Ativos</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-3xl font-bold text-amber-600">{totalTenants - activeTenants}</p>
                <p className="text-sm text-muted-foreground">Inativos/Trial</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Configurações Globais</CardTitle>
              <CardDescription>Ajustes que afetam toda a plataforma</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">Modo de Manutenção</Label>
              <p className="text-sm text-muted-foreground">Desabilita acesso de tenants temporariamente</p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={setMaintenanceMode}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">Registro de Novos Tenants</Label>
              <p className="text-sm text-muted-foreground">Permitir criação de novos tenants</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">Logs de Auditoria</Label>
              <p className="text-sm text-muted-foreground">Registrar todas as ações dos usuários</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Segurança</CardTitle>
              <CardDescription>Configurações de segurança da plataforma</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">Rate Limiting</Label>
              <p className="text-sm text-muted-foreground">Limitar requisições por IP/tenant</p>
            </div>
            <Badge variant="default">Ativo</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">JWT Token Blacklist</Label>
              <p className="text-sm text-muted-foreground">Revogação de tokens via Redis</p>
            </div>
            <Badge variant="default">Ativo</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">HMAC Webhook Validation</Label>
              <p className="text-sm text-muted-foreground">Validação de assinatura dos webhooks</p>
            </div>
            <Badge variant="default">Ativo</Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="font-medium">2FA (Autenticação de Dois Fatores)</Label>
              <p className="text-sm text-muted-foreground">Exigir 2FA para administradores</p>
            </div>
            <Badge variant="secondary">Em breve</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
