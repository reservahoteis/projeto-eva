'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MessageSquare, Bell, Users, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

const whatsappConfigSchema = z.object({
  whatsappPhoneNumberId: z.string().min(1, 'Phone Number ID é obrigatório'),
  whatsappAccessToken: z.string().min(1, 'Access Token é obrigatório'),
  whatsappBusinessAccountId: z.string().min(1, 'Business Account ID é obrigatório'),
  whatsappWebhookVerifyToken: z.string().optional(),
  whatsappAppSecret: z.string().optional(),
});

type WhatsAppConfigData = z.infer<typeof whatsappConfigSchema>;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // Query para carregar config do WhatsApp
  const {
    data: whatsappConfig,
    isLoading: isLoadingConfig,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['whatsapp-config'],
    queryFn: () => settingsService.getWhatsAppConfig(),
  });

  // Mutation para atualizar config
  const updateConfigMutation = useMutation({
    mutationFn: settingsService.updateWhatsAppConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-config'] });
      setIsConfigDialogOpen(false);
      toast.success('Configuração do WhatsApp atualizada com sucesso');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erro ao atualizar configuração';
      toast.error(message);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<WhatsAppConfigData>({
    resolver: zodResolver(whatsappConfigSchema),
  });

  const handleConfigSubmit = async (data: WhatsAppConfigData) => {
    await updateConfigMutation.mutateAsync(data);
  };

  const handleOpenConfigDialog = () => {
    reset();
    setIsConfigDialogOpen(true);
  };

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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-whatsapp-green/10 p-2">
                    <MessageSquare className="h-5 w-5 text-whatsapp-green" />
                  </div>
                  <div>
                    <CardTitle>Conexão WhatsApp Business</CardTitle>
                    <CardDescription>Configure sua integração com a API do WhatsApp</CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchConfig()}
                  disabled={isLoadingConfig}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingConfig ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingConfig ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {whatsappConfig?.isConnected ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <div className="flex-1">
                        <p className="font-medium text-green-900">WhatsApp Conectado</p>
                        <p className="text-sm text-green-700">Sua conta está conectada e funcionando</p>
                      </div>
                      <Badge className="bg-green-600">Ativo</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="h-3 w-3 rounded-full bg-yellow-500" />
                      <div className="flex-1">
                        <p className="font-medium text-yellow-900">WhatsApp Não Configurado</p>
                        <p className="text-sm text-yellow-700">
                          Configure suas credenciais do WhatsApp Business API
                        </p>
                      </div>
                      <Badge variant="secondary">Inativo</Badge>
                    </div>
                  )}

                  {whatsappConfig?.whatsappPhoneNumberId && (
                    <>
                      <div className="space-y-2">
                        <Label>Phone Number ID</Label>
                        <Input value={whatsappConfig.whatsappPhoneNumberId} disabled />
                      </div>

                      <div className="space-y-2">
                        <Label>Business Account ID</Label>
                        <Input
                          value={whatsappConfig.whatsappBusinessAccountId || 'Não configurado'}
                          disabled
                        />
                      </div>

                      {whatsappConfig.phoneNumber && (
                        <div className="space-y-2">
                          <Label>Número do WhatsApp</Label>
                          <Input value={whatsappConfig.phoneNumber} disabled />
                        </div>
                      )}
                    </>
                  )}

                  <div className="pt-4 border-t flex gap-2">
                    <Button onClick={handleOpenConfigDialog}>
                      {whatsappConfig?.isConnected ? 'Atualizar Configuração' : 'Configurar WhatsApp'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensagens Automáticas</CardTitle>
              <CardDescription>Configure respostas automáticas (em breve)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Funcionalidade de mensagens automáticas em desenvolvimento...
              </p>
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
                Acesse a página de{' '}
                <Link href="/dashboard/users" className="text-primary underline font-medium">
                  Usuários
                </Link>{' '}
                para gerenciar sua equipe.
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
                <p className="text-sm text-muted-foreground mb-2">
                  Altere sua senha de acesso ao sistema
                </p>
                <Button variant="outline" disabled>
                  Alterar Senha (em breve)
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Autenticação de Dois Fatores</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Adicione uma camada extra de segurança à sua conta
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Desativado</Badge>
                  <Button variant="outline" size="sm" disabled>
                    Ativar 2FA (em breve)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Configuração do WhatsApp */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar WhatsApp Business API</DialogTitle>
            <DialogDescription>
              Insira as credenciais da sua conta do WhatsApp Business API. Você pode obter essas informações no{' '}
              <a
                href="https://developers.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Meta for Developers
              </a>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleConfigSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappPhoneNumberId">
                Phone Number ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsappPhoneNumberId"
                {...register('whatsappPhoneNumberId')}
                placeholder="123456789012345"
                disabled={updateConfigMutation.isPending}
              />
              {errors.whatsappPhoneNumberId && (
                <p className="text-sm text-destructive">{errors.whatsappPhoneNumberId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappAccessToken">
                Access Token <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsappAccessToken"
                type="password"
                {...register('whatsappAccessToken')}
                placeholder="EAAxxxxxxxxxx..."
                disabled={updateConfigMutation.isPending}
              />
              {errors.whatsappAccessToken && (
                <p className="text-sm text-destructive">{errors.whatsappAccessToken.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappBusinessAccountId">
                Business Account ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="whatsappBusinessAccountId"
                {...register('whatsappBusinessAccountId')}
                placeholder="987654321098765"
                disabled={updateConfigMutation.isPending}
              />
              {errors.whatsappBusinessAccountId && (
                <p className="text-sm text-destructive">{errors.whatsappBusinessAccountId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappWebhookVerifyToken">
                Webhook Verify Token <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="whatsappWebhookVerifyToken"
                {...register('whatsappWebhookVerifyToken')}
                placeholder="seu_token_de_verificacao"
                disabled={updateConfigMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappAppSecret">
                App Secret <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="whatsappAppSecret"
                type="password"
                {...register('whatsappAppSecret')}
                placeholder="app_secret_key"
                disabled={updateConfigMutation.isPending}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfigDialogOpen(false)}
                disabled={updateConfigMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateConfigMutation.isPending}>
                {updateConfigMutation.isPending ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
