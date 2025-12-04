'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  userName: string;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ResetPasswordForm({
  userName,
  onSubmit,
  onCancel,
  isLoading,
}: ResetPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const handleFormSubmit = async (data: ResetPasswordData) => {
    await onSubmit(data.password);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Redefinindo senha para: <strong>{userName}</strong>
      </p>

      {/* Nova Senha */}
      <div className="space-y-2">
        <Label htmlFor="password">
          Nova Senha <span className="text-destructive">*</span>
        </Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          placeholder="Mínimo 8 caracteres"
          disabled={isLoading}
          autoFocus
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Confirmar Senha */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">
          Confirmar Senha <span className="text-destructive">*</span>
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          {...register('confirmPassword')}
          placeholder="Digite a senha novamente"
          disabled={isLoading}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      {/* Botões */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Salvando...' : 'Redefinir Senha'}
        </Button>
      </div>
    </form>
  );
}
