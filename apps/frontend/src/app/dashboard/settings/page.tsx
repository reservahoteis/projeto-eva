'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, MessageSquare, Bell, Users, Shield } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações do seu CRM</p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-6">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
        </TabsList>

        {/* WhatsApp Settings */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-whatsapp-green/10 p-2">
                  <MessageSquare className="h-5 w-5 text-whatsapp-green" />
                </div>
                <div>
                  <CardTitle>Conexão WhatsApp Business</CardTitle>
                  <CardDescription>Configure sua integração com a API do WhatsApp</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">WhatsApp Conectado</p>
                  <p className="text-sm text-green-700">Sua conta está conectada e funcionando</p>
                </div>
                <Badge variant="success">Ativo</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp</Label>
                <Input id="phone" defaultValue="+55 11 98765-4321" disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessAccountId">Business Account ID</Label>
                <Input id="businessAccountId" defaultValue="123456789012345" disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                <Input id="phoneNumberId" defaultValue="987654321098765" disabled />
              </div>

              <div className="pt-4 border-t">
                <Button variant="outline">Reconectar WhatsApp</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens Automáticas</CardTitle>
              <CardDescription>Configure respostas automáticas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="welcomeMessage">Mensagem de Boas-Vindas</Label>
                <Input
                  id="welcomeMessage"
                  placeholder="Olá! Obrigado por entrar em contato..."
                  defaultValue="Olá! Bem-vindo ao nosso hotel. Como podemos ajudá-lo?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="awayMessage">Mensagem Fora do Horário</Label>
                <Input
                  id="awayMessage"
                  placeholder="No momento estamos fora do horário..."
                  defaultValue="Estamos fora do horário de atendimento. Retornaremos em breve!"
                />
              </div>

              <Button>Salvar Alterações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Notificações</CardTitle>
                  <CardDescription>Escolha como deseja ser notificado</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Configurações de notificação em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-100 p-2">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Configurações da Equipe</CardTitle>
                  <CardDescription>Gerencie sua equipe de atendimento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Acesse a página de <a href="/dashboard/users" className="text-primary underline">Usuários</a> para gerenciar sua equipe.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-100 p-2">
                  <Shield className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>Configurações de segurança da conta</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Senha</Label>
                <Button variant="outline">Alterar Senha</Button>
              </div>

              <div className="space-y-2">
                <Label>Autenticação de Dois Fatores</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Desativado</Badge>
                  <Button variant="outline" size="sm">
                    Ativar 2FA
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
