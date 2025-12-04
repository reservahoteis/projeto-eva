'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';
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

  const settingsTabs = [
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, iconBoxClass: 'icon-box icon-box-green' },
    { value: 'notifications', label: 'Notificações', icon: Bell, iconBoxClass: 'icon-box icon-box-blue' },
    { value: 'team', label: 'Equipe', icon: Users, iconBoxClass: 'icon-box icon-box-purple' },
    { value: 'security', label: 'Segurança', icon: Shield, iconBoxClass: 'icon-box icon-box-rose' },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 liquid-bg min-h-screen">
      {/* Header */}
      <div className="animate-fadeIn">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Configurações</h1>
        <p className="text-sm md:text-base text-[var(--text-muted)]">Gerencie as configurações do sistema</p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-6">
        <TabsList className="glass-card p-1 h-auto flex-wrap">
          {settingsTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-[var(--glass-bg-strong)] data-[state=active]:shadow-lg rounded-ios-xs px-4 py-2"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* WhatsApp Settings */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="glass-card p-6 animate-slideUp">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-green">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Conexão WhatsApp Business</h2>
                  <p className="text-sm text-[var(--text-muted)]">Configure sua integração com a API do WhatsApp</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetchConfig()}
                disabled={isLoadingConfig}
                className="glass-btn"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingConfig ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {isLoadingConfig ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                {whatsappConfig?.isConnected ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-ios-xs mb-4">
                    <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                    <div className="flex-1">
                      <p className="font-medium text-emerald-600">WhatsApp Conectado</p>
                      <p className="text-sm text-emerald-500/80">Sua conta está conectada e funcionando</p>
                    </div>
                    <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0">Ativo</Badge>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-ios-xs mb-4">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-600">WhatsApp Não Configurado</p>
                      <p className="text-sm text-amber-500/80">
                        Configure suas credenciais do WhatsApp Business API
                      </p>
                    </div>
                    <Badge variant="secondary">Inativo</Badge>
                  </div>
                )}

                {whatsappConfig?.whatsappPhoneNumberId && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[var(--text-secondary)]">Phone Number ID</Label>
                      <Input value={whatsappConfig.whatsappPhoneNumberId} disabled className="glass-input" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[var(--text-secondary)]">Business Account ID</Label>
                      <Input
                        value={whatsappConfig.whatsappBusinessAccountId || 'Não configurado'}
                        disabled
                        className="glass-input"
                      />
                    </div>

                    {whatsappConfig.phoneNumber && (
                      <div className="space-y-2">
                        <Label className="text-[var(--text-secondary)]">Número do WhatsApp</Label>
                        <Input value={whatsappConfig.phoneNumber} disabled className="glass-input" />
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-[var(--glass-border)] mt-4">
                  <Button onClick={handleOpenConfigDialog} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg">
                    {whatsappConfig?.isConnected ? 'Atualizar Configuração' : 'Configurar WhatsApp'}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="glass-card p-6 animate-slideUp" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="icon-box icon-box-amber">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mensagens Automáticas</h2>
                <p className="text-sm text-[var(--text-muted)]">Configure respostas automáticas (em breve)</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Funcionalidade de mensagens automáticas em desenvolvimento...
            </p>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="glass-card p-6 animate-slideUp">
            <div className="flex items-center gap-4 mb-4">
              <div className="icon-box icon-box-blue">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notificações</h2>
                <p className="text-sm text-[var(--text-muted)]">Escolha como deseja ser notificado</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Configurações de notificação em desenvolvimento...</p>
          </div>
        </TabsContent>

        {/* Team */}
        <TabsContent value="team" className="space-y-4">
          <div className="glass-card p-6 animate-slideUp">
            <div className="flex items-center gap-4 mb-4">
              <div className="icon-box icon-box-purple">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Configurações da Equipe</h2>
                <p className="text-sm text-[var(--text-muted)]">Gerencie sua equipe de atendimento</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Acesse a página de{' '}
              <Link href="/dashboard/users" className="text-blue-500 underline font-medium hover:text-blue-600">
                Usuários
              </Link>{' '}
              para gerenciar sua equipe.
            </p>
          </div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <div className="glass-card p-6 animate-slideUp">
            <div className="flex items-center gap-4 mb-6">
              <div className="icon-box icon-box-rose">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Segurança</h2>
                <p className="text-sm text-[var(--text-muted)]">Configurações de segurança da conta</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-ios-xs bg-[var(--glass-bg-hover)]">
                <Label className="text-[var(--text-primary)] font-medium">Senha</Label>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Altere sua senha de acesso ao sistema
                </p>
                <Button variant="outline" disabled className="glass-btn">
                  Alterar Senha (em breve)
                </Button>
              </div>

              <div className="p-4 rounded-ios-xs bg-[var(--glass-bg-hover)]">
                <Label className="text-[var(--text-primary)] font-medium">Autenticação de Dois Fatores</Label>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  Adicione uma camada extra de segurança à sua conta
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Desativado</Badge>
                  <Button variant="outline" size="sm" disabled className="glass-btn">
                    Ativar 2FA (em breve)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Configuração do WhatsApp */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-2xl glass-card">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">Configurar WhatsApp Business API</DialogTitle>
            <DialogDescription className="text-[var(--text-muted)]">
              Insira as credenciais da sua conta do WhatsApp Business API. Você pode obter essas informações no{' '}
              <a
                href="https://developers.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                Meta for Developers
              </a>
              .
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(handleConfigSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappPhoneNumberId" className="text-[var(--text-secondary)]">
                Phone Number ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="whatsappPhoneNumberId"
                {...register('whatsappPhoneNumberId')}
                placeholder="123456789012345"
                disabled={updateConfigMutation.isPending}
                className="glass-input"
              />
              {errors.whatsappPhoneNumberId && (
                <p className="text-sm text-red-500">{errors.whatsappPhoneNumberId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappAccessToken" className="text-[var(--text-secondary)]">
                Access Token <span className="text-red-500">*</span>
              </Label>
              <Input
                id="whatsappAccessToken"
                type="password"
                {...register('whatsappAccessToken')}
                placeholder="EAAxxxxxxxxxx..."
                disabled={updateConfigMutation.isPending}
                className="glass-input"
              />
              {errors.whatsappAccessToken && (
                <p className="text-sm text-red-500">{errors.whatsappAccessToken.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappBusinessAccountId" className="text-[var(--text-secondary)]">
                Business Account ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="whatsappBusinessAccountId"
                {...register('whatsappBusinessAccountId')}
                placeholder="987654321098765"
                disabled={updateConfigMutation.isPending}
                className="glass-input"
              />
              {errors.whatsappBusinessAccountId && (
                <p className="text-sm text-red-500">{errors.whatsappBusinessAccountId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappWebhookVerifyToken" className="text-[var(--text-secondary)]">
                Webhook Verify Token <span className="text-[var(--text-muted)]">(opcional)</span>
              </Label>
              <Input
                id="whatsappWebhookVerifyToken"
                {...register('whatsappWebhookVerifyToken')}
                placeholder="seu_token_de_verificacao"
                disabled={updateConfigMutation.isPending}
                className="glass-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappAppSecret" className="text-[var(--text-secondary)]">
                App Secret <span className="text-[var(--text-muted)]">(opcional)</span>
              </Label>
              <Input
                id="whatsappAppSecret"
                type="password"
                {...register('whatsappAppSecret')}
                placeholder="app_secret_key"
                disabled={updateConfigMutation.isPending}
                className="glass-input"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsConfigDialogOpen(false)}
                disabled={updateConfigMutation.isPending}
                className="glass-btn w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateConfigMutation.isPending} className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white w-full sm:w-auto">
                {updateConfigMutation.isPending ? 'Salvando...' : 'Salvar Configuração'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
