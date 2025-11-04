'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Clock, MessageSquare, Users } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Análises e métricas do seu CRM</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas (30 dias)</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +12% vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5min</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              -2min vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resolução</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              +5% vs mês anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendentes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">De 10 total</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Resolvidas</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '75%' }} />
                  </div>
                  <span className="text-sm font-medium">75%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Em Andamento</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '15%' }} />
                  </div>
                  <span className="text-sm font-medium">15%</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Abertas</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: '10%' }} />
                  </div>
                  <span className="text-sm font-medium">10%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance por Atendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ana Silva</p>
                  <p className="text-xs text-muted-foreground">45 conversas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">98%</p>
                  <p className="text-xs text-muted-foreground">satisfação</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pedro Santos</p>
                  <p className="text-xs text-muted-foreground">38 conversas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">95%</p>
                  <p className="text-xs text-muted-foreground">satisfação</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Maria Costa</p>
                  <p className="text-xs text-muted-foreground">32 conversas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">92%</p>
                  <p className="text-xs text-muted-foreground">satisfação</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Horários de Pico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Volume de mensagens por hora</p>
          <div className="flex items-end justify-between gap-2 h-40">
            {[20, 15, 25, 45, 60, 85, 95, 90, 75, 60, 40, 30].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-primary rounded-t" style={{ height: `${height}%` }} />
                <span className="text-xs text-muted-foreground">{i + 8}h</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
