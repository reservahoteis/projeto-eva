'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserRole, type User } from '@/types';

// Unidades hoteleiras disponíveis
const HOTEL_UNITS = [
  'Ilha Bela',
  'Campos do Jordão',
  'Camburi',
  'Santo Antônio do Pinhal',
] as const;

const userFormSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  email: z.string().email('Email inválido'),
  role: z.nativeEnum(UserRole),
  hotelUnit: z.string().optional().nullable(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').optional().or(z.literal('')),
  avatarUrl: z.string().url('URL inválida').optional().or(z.literal('')),
}).refine((data) => {
  // Atendentes devem ter unidade definida
  if (data.role === UserRole.ATTENDANT && !data.hotelUnit) {
    return false;
  }
  return true;
}, {
  message: 'Atendentes devem ter uma unidade hoteleira definida',
  path: ['hotelUnit'],
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: User;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel = 'Salvar',
}: UserFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      role: user?.role || UserRole.ATTENDANT,
      hotelUnit: (user as any)?.hotelUnit || null,
      password: '',
      avatarUrl: user?.avatar || '',
    },
  });

  const selectedRole = watch('role');
  const selectedHotelUnit = watch('hotelUnit');

  const handleFormSubmit = async (data: UserFormData) => {
    // Se está editando e não preencheu senha, remover do payload
    const payload = { ...data };
    if (user && !payload.password) {
      delete payload.password;
    }
    // Se avatarUrl vazio, remover
    if (!payload.avatarUrl) {
      delete payload.avatarUrl;
    }
    // Se não for atendente, limpar hotelUnit
    if (payload.role !== UserRole.ATTENDANT) {
      payload.hotelUnit = null;
    }
    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Nome */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Nome <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Nome completo"
          disabled={isLoading}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="email@example.com"
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Perfil/Role */}
      <div className="space-y-2">
        <Label htmlFor="role">
          Perfil <span className="text-destructive">*</span>
        </Label>
        <Select
          value={selectedRole}
          onValueChange={(value) => {
            setValue('role', value as UserRole);
            // Limpar unidade se mudar para admin
            if (value === UserRole.TENANT_ADMIN) {
              setValue('hotelUnit', null);
            }
          }}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o perfil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UserRole.ATTENDANT}>Atendente</SelectItem>
            <SelectItem value={UserRole.TENANT_ADMIN}>Administrador</SelectItem>
          </SelectContent>
        </Select>
        {errors.role && (
          <p className="text-sm text-destructive">{errors.role.message}</p>
        )}
      </div>

      {/* Unidade Hoteleira (apenas para atendentes) */}
      {selectedRole === UserRole.ATTENDANT && (
        <div className="space-y-2">
          <Label htmlFor="hotelUnit">
            Unidade Hoteleira <span className="text-destructive">*</span>
          </Label>
          <Select
            value={selectedHotelUnit || ''}
            onValueChange={(value) => setValue('hotelUnit', value)}
            disabled={isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a unidade" />
            </SelectTrigger>
            <SelectContent>
              {HOTEL_UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.hotelUnit && (
            <p className="text-sm text-destructive">{errors.hotelUnit.message}</p>
          )}
        </div>
      )}

      {/* Senha */}
      <div className="space-y-2">
        <Label htmlFor="password">
          Senha {!user && <span className="text-destructive">*</span>}
          {user && <span className="text-muted-foreground text-xs"> (deixe vazio para manter)</span>}
        </Label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          placeholder={user ? 'Digite para alterar a senha' : 'Mínimo 8 caracteres'}
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Avatar URL (opcional) */}
      <div className="space-y-2">
        <Label htmlFor="avatarUrl">
          URL do Avatar <span className="text-muted-foreground text-xs">(opcional)</span>
        </Label>
        <Input
          id="avatarUrl"
          type="url"
          {...register('avatarUrl')}
          placeholder="https://example.com/avatar.jpg"
          disabled={isLoading}
        />
        {errors.avatarUrl && (
          <p className="text-sm text-destructive">{errors.avatarUrl.message}</p>
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
          {isLoading ? 'Salvando...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
