'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Mail } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
    } catch (error) {
      // Error handling is done in AuthContext with toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center liquid-bg p-4">
      {/* Login Card - iOS 26 Liquid Glass Style */}
      <div className="relative w-full max-w-md animate-scaleIn">
        <div className="glass-card p-8">
          {/* Logo Header - Style like ERP Angelus */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center shadow-lg mb-4 overflow-hidden border border-[var(--glass-border)]">
              <Image
                src="/logo.png"
                alt="Hotéis Reserva"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
              Hotéis Reserva
            </h1>
            <p className="text-[var(--text-muted)] text-sm">
              Sistema de Atendimento WhatsApp
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--text-secondary)] font-medium text-sm">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="glass-input h-12 pl-12 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  {...register('email')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--text-secondary)] font-medium text-sm">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="glass-input h-12 pl-12 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  {...register('password')}
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-ios-xs shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[var(--glass-border)]">
            <p className="text-center text-xs text-[var(--text-muted)]">
              Desenvolvido para gestão de atendimento via WhatsApp
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
