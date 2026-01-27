'use client';

import { useQuery } from '@tanstack/react-query';
import { conversationService } from '@/services/conversation.service';
import { MessageSquare, Users, Clock, CheckCircle2, AlertCircle, TrendingUp, Phone, Target, DollarSign, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { UserRole } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const isSales = user?.role === UserRole.SALES;

  const { data: stats } = useQuery({
    queryKey: ['conversation-stats'],
    queryFn: () => conversationService.getStats(),
  });

  // Stats cards para usuários normais
  const normalStatsCards = [
    {
      title: 'TOTAL CONVERSAS',
      value: stats?.total || 0,
      icon: MessageSquare,
      iconBoxClass: 'icon-box icon-box-blue',
      trend: '+5.2%',
      trendUp: true,
    },
    {
      title: 'EM ABERTO',
      value: stats?.open || 0,
      icon: AlertCircle,
      iconBoxClass: 'icon-box icon-box-amber',
      trend: '+3',
      trendUp: true,
    },
    {
      title: 'EM ANDAMENTO',
      value: stats?.inProgress || 0,
      icon: Clock,
      iconBoxClass: 'icon-box icon-box-orange',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'RESOLVIDAS',
      value: stats?.resolved || 0,
      icon: CheckCircle2,
      iconBoxClass: 'icon-box icon-box-green',
      trend: '+8%',
      trendUp: true,
    },
  ];

  // Stats cards para SALES (oportunidades)
  const salesStatsCards = [
    {
      title: 'OPORTUNIDADES',
      value: stats?.opportunities || 0,
      icon: Target,
      iconBoxClass: 'icon-box icon-box-purple',
      trend: 'Novas',
      trendUp: true,
    },
    {
      title: 'EM ATENDIMENTO',
      value: stats?.inProgress || 0,
      icon: Clock,
      iconBoxClass: 'icon-box icon-box-blue',
      trend: 'Ativas',
      trendUp: true,
    },
    {
      title: 'CONVERTIDAS',
      value: stats?.resolved || 0,
      icon: DollarSign,
      iconBoxClass: 'icon-box icon-box-green',
      trend: 'Sucesso',
      trendUp: true,
    },
    {
      title: 'AGUARDANDO',
      value: stats?.waiting || 0,
      icon: UserCheck,
      iconBoxClass: 'icon-box icon-box-amber',
      trend: 'Retorno',
      trendUp: true,
    },
  ];

  const statsCards = isSales ? salesStatsCards : normalStatsCards;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="animate-fadeIn">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
          {isSales ? 'Painel de Vendas' : 'Dashboard'}
        </h1>
        <p className="text-sm md:text-base text-[var(--text-muted)]">
          {isSales
            ? `Olá, ${user?.name}! Gerencie suas oportunidades de venda.`
            : `Bem-vindo, ${user?.name}! Aqui está um resumo das suas conversas.`
          }
        </p>
      </div>

      {/* Stats Cards - ERP Angelus Style */}
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
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className={`w-3 h-3 ${stat.trendUp ? 'text-emerald-500' : 'text-red-500'}`} />
                    <span className={`text-xs font-medium ${stat.trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                      {stat.trend}
                    </span>
                  </div>
                </div>
                <div className={stat.iconBoxClass}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions - Glass Style */}
      <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.4s' }}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Ações Rápidas</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {isSales ? (
            // Quick Actions para SALES
            <>
              <a
                href="/dashboard/conversations"
                className="flex items-center gap-4 p-4 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="icon-box icon-box-purple">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Ver Oportunidades</p>
                  <p className="text-sm text-[var(--text-muted)]">Clientes aguardando</p>
                </div>
              </a>

              <a
                href="/dashboard/conversations?status=IN_PROGRESS"
                className="flex items-center gap-4 p-4 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="icon-box icon-box-blue">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Em Atendimento</p>
                  <p className="text-sm text-[var(--text-muted)]">Conversas ativas</p>
                </div>
              </a>

              <a
                href="/dashboard/conversations?status=CLOSED"
                className="flex items-center gap-4 p-4 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="icon-box icon-box-green">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Convertidas</p>
                  <p className="text-sm text-[var(--text-muted)]">Vendas realizadas</p>
                </div>
              </a>
            </>
          ) : (
            // Quick Actions para outros usuários
            <>
              <a
                href="/dashboard/conversations?status=OPEN"
                className="flex items-center gap-4 p-4 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="icon-box icon-box-amber">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Conversas Pendentes</p>
                  <p className="text-sm text-[var(--text-muted)]">Ver todas abertas</p>
                </div>
              </a>

              <a
                href="/dashboard/conversations?assignedToMe=true"
                className="flex items-center gap-4 p-4 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="icon-box icon-box-blue">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Minhas Conversas</p>
                  <p className="text-sm text-[var(--text-muted)]">Atribuídas a mim</p>
                </div>
              </a>

              <a
                href="/dashboard/contacts"
                className="flex items-center gap-4 p-4 rounded-ios-xs bg-[var(--glass-bg-hover)] hover:bg-[var(--glass-bg-strong)] transition-all duration-200 hover:-translate-y-1"
              >
                <div className="icon-box icon-box-green">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Contatos</p>
                  <p className="text-sm text-[var(--text-muted)]">Gerenciar contatos</p>
                </div>
              </a>
            </>
          )}
        </div>
      </div>

      {/* WhatsApp Status - Glass Style (somente para não-SALES) */}
      {!isSales && (
        <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Status do WhatsApp</h2>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
            <p className="text-sm text-[var(--text-secondary)]">WhatsApp conectado e funcionando</p>
          </div>
        </div>
      )}

      {/* Dicas para SALES */}
      {isSales && (
        <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.5s' }}>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Dicas de Vendas</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--glass-bg-hover)]">
              <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
              <p className="text-sm text-[var(--text-secondary)]">
                <strong>Oportunidades:</strong> Clientes que não conseguiram finalizar a reserva pelo bot. Entre em contato rapidamente!
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--glass-bg-hover)]">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
              <p className="text-sm text-[var(--text-secondary)]">
                <strong>Tempo de resposta:</strong> Quanto mais rápido você responder, maior a chance de conversão.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--glass-bg-hover)]">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
              <p className="text-sm text-[var(--text-secondary)]">
                <strong>Ao finalizar:</strong> Marque a conversa como "Fechada" quando concluir o atendimento.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
