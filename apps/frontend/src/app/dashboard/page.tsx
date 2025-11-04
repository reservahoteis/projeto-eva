'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['conversation-stats'],
    queryFn: () => conversationService.getStats(),
  });

  const statsCards = [
    {
      title: 'Total de Conversas',
      value: stats?.total || 0,
      icon: MessageSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Em Aberto',
      value: stats?.open || 0,
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      title: 'Em Andamento',
      value: stats?.inProgress || 0,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      title: 'Resolvidas',
      value: stats?.resolved || 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo, {user?.name}! Aqui está um resumo das suas conversas.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`rounded-full p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/dashboard/conversations?status=OPEN"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="rounded-full bg-yellow-100 p-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium">Conversas Pendentes</p>
                <p className="text-sm text-muted-foreground">Ver todas abertas</p>
              </div>
            </a>

            <a
              href="/dashboard/conversations?assignedToMe=true"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="rounded-full bg-blue-100 p-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Minhas Conversas</p>
                <p className="text-sm text-muted-foreground">Atribuídas a mim</p>
              </div>
            </a>

            <a
              href="/dashboard/contacts"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="rounded-full bg-green-100 p-2">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Contatos</p>
                <p className="text-sm text-muted-foreground">Gerenciar contatos</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Status */}
      <Card>
        <CardHeader>
          <CardTitle>Status do WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <p className="text-sm">WhatsApp conectado e funcionando</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
