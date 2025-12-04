'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { tenantService } from '@/services/tenant.service';
import { TenantPlan } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const createTenantSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  slug: z
    .string()
    .min(3, 'Slug deve ter no mínimo 3 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  email: z.string().email('Email inválido'),
  plan: z.nativeEnum(TenantPlan),
});

type CreateTenantFormData = z.infer<typeof createTenantSchema>;

interface CreateTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateTenantDialog({ open, onOpenChange, onSuccess }: CreateTenantDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<{
    loginUrl: string;
    adminEmail: string;
    temporaryPassword: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
    watch,
  } = useForm<CreateTenantFormData>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      plan: TenantPlan.BASIC,
    },
  });

  const selectedPlan = watch('plan');

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single

    setValue('slug', slug);
  };

  const onSubmit = async (data: CreateTenantFormData) => {
    setIsLoading(true);
    try {
      const result = await tenantService.create(data);

      setCreatedTenant({
        loginUrl: result.loginUrl,
        adminEmail: result.adminUser.email,
        temporaryPassword: result.adminUser.temporaryPassword,
      });

      toast.success('Tenant criado com sucesso!');
      reset();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao criar tenant';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (createdTenant) {
      setCreatedTenant(null);
      onSuccess();
    } else {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {!createdTenant ? (
          <>
            <DialogHeader>
              <DialogTitle>Criar Novo Tenant</DialogTitle>
              <DialogDescription>Adicione um novo hotel ao sistema</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Hotel</Label>
                <Input
                  id="name"
                  placeholder="Hotel Copacabana"
                  {...register('name')}
                  onChange={(e) => {
                    register('name').onChange(e);
                    handleNameChange(e);
                  }}
                  disabled={isLoading}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (Subdomínio)</Label>
                <div className="flex items-center gap-2">
                  <Input id="slug" placeholder="hotel-copacabana" {...register('slug')} disabled={isLoading} />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">.seucrm.com</span>
                </div>
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email do Administrador</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@hotelcopacabana.com"
                  {...register('email')}
                  disabled={isLoading}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select value={selectedPlan} onValueChange={(value) => setValue('plan', value as TenantPlan)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TenantPlan.BASIC}>Basic - R$ 99/mês</SelectItem>
                    <SelectItem value={TenantPlan.PROFESSIONAL}>Professional - R$ 299/mês</SelectItem>
                    <SelectItem value={TenantPlan.ENTERPRISE}>Enterprise - R$ 799/mês</SelectItem>
                  </SelectContent>
                </Select>
                {errors.plan && <p className="text-sm text-destructive">{errors.plan.message}</p>}
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                  {isLoading ? 'Criando...' : 'Criar Tenant'}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Tenant Criado com Sucesso! ✅</DialogTitle>
              <DialogDescription>Anote as credenciais abaixo antes de fechar</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">URL de Login:</p>
                  <code className="text-sm text-primary">{createdTenant.loginUrl}</code>
                </div>
                <div>
                  <p className="text-sm font-medium">Email do Admin:</p>
                  <code className="text-sm">{createdTenant.adminEmail}</code>
                </div>
                <div>
                  <p className="text-sm font-medium">Senha Temporária:</p>
                  <code className="text-sm text-destructive">{createdTenant.temporaryPassword}</code>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                ⚠️ <strong>IMPORTANTE:</strong> Copie essas credenciais e envie para o administrador do tenant. Ele
                deverá trocar a senha no primeiro acesso.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button onClick={handleClose} className="w-full sm:w-auto">Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
