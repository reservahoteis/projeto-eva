'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { Lock, Mail, ArrowRight, Loader2, Building2 } from 'lucide-react';

const loginSchema = z.object({
  tenantSlug: z.string().optional(),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
      await login(data.email, data.password, data.tenantSlug || undefined);
    } catch (error) {
      // Error handling is done in AuthContext with toast
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ backgroundColor: 'var(--surface-gray-1)' }}
    >
      <div className="w-full max-w-[400px]">
        {/* Card */}
        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/logo-smart-hoteis.png"
              alt="Smart Hoteis"
              width={180}
              height={72}
              className="object-contain mb-3"
              priority
            />
            <p
              className="text-sm"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              Sistema de Atendimento
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Tenant Slug */}
            <div>
              <label
                htmlFor="tenantSlug"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--ink-gray-6)' }}
              >
                Hotel (slug)
              </label>
              <div className="relative">
                <Building2
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{
                    color: focusedField === 'tenantSlug'
                      ? 'var(--ink-gray-7)'
                      : 'var(--ink-gray-4)',
                  }}
                />
                <input
                  id="tenantSlug"
                  type="text"
                  placeholder="deixe vazio para Super Admin"
                  className="w-full rounded-md py-2.5 pl-10 pr-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--surface-gray-1)',
                    color: 'var(--ink-gray-9)',
                    border: `1px solid ${
                      focusedField === 'tenantSlug'
                        ? 'var(--outline-gray-3)'
                        : 'var(--outline-gray-1)'
                    }`,
                  }}
                  {...register('tenantSlug')}
                  disabled={isLoading}
                  onFocus={() => setFocusedField('tenantSlug')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--ink-gray-6)' }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{
                    color: focusedField === 'email'
                      ? 'var(--ink-gray-7)'
                      : 'var(--ink-gray-4)',
                  }}
                />
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full rounded-md py-2.5 pl-10 pr-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--surface-gray-1)',
                    color: 'var(--ink-gray-9)',
                    border: `1px solid ${
                      errors.email
                        ? 'var(--ink-red)'
                        : focusedField === 'email'
                          ? 'var(--outline-gray-3)'
                          : 'var(--outline-gray-1)'
                    }`,
                  }}
                  {...register('email')}
                  disabled={isLoading}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.email && (
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--ink-red)' }}
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--ink-gray-6)' }}
              >
                Senha
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{
                    color: focusedField === 'password'
                      ? 'var(--ink-gray-7)'
                      : 'var(--ink-gray-4)',
                  }}
                />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-md py-2.5 pl-10 pr-3 text-sm outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--surface-gray-1)',
                    color: 'var(--ink-gray-9)',
                    border: `1px solid ${
                      errors.password
                        ? 'var(--ink-red)'
                        : focusedField === 'password'
                          ? 'var(--outline-gray-3)'
                          : 'var(--outline-gray-1)'
                    }`,
                  }}
                  {...register('password')}
                  disabled={isLoading}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              {errors.password && (
                <p
                  className="text-xs mt-1"
                  style={{ color: 'var(--ink-red)' }}
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all mt-2"
              style={{
                backgroundColor: 'var(--surface-gray-7)',
                color: 'var(--surface-white)',
                opacity: isLoading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--ink-gray-9)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-gray-7)';
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: 'var(--ink-gray-4)' }}
        >
          Smart Hoteis &middot; Atendimento via WhatsApp
        </p>
      </div>
    </div>
  );
}
