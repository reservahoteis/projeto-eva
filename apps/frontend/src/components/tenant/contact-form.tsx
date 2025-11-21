'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Phone, User, Mail, Image, Save } from 'lucide-react';
import type { Contact } from '@/types';

// Schema de validação
const contactFormSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, 'Número de telefone é obrigatório')
    .regex(/^\d+$/, 'Apenas dígitos são permitidos')
    .min(10, 'Número deve ter no mínimo 10 dígitos')
    .max(15, 'Número deve ter no máximo 15 dígitos')
    .refine((val) => {
      // Validação adicional para números brasileiros
      if (val.startsWith('55')) {
        return val.length >= 12 && val.length <= 13;
      }
      return true;
    }, 'Número brasileiro deve ter formato: 55DDDNUMERO'),

  name: z
    .string()
    .min(1, 'Nome deve ter pelo menos 1 caractere')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .optional()
    .or(z.literal('')),

  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),

  profilePictureUrl: z
    .string()
    .url('URL da imagem inválida')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .max(500, 'Notas devem ter no máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  contact?: Contact | null;
  onSubmit: (data: ContactFormData) => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function ContactForm({
  contact,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Salvar',
}: ContactFormProps) {
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      phoneNumber: '',
      name: '',
      email: '',
      profilePictureUrl: '',
      notes: '',
    },
  });

  // Preencher formulário com dados do contato
  useEffect(() => {
    if (contact) {
      form.reset({
        phoneNumber: contact.phoneNumber,
        name: contact.name || '',
        email: contact.email || '',
        profilePictureUrl: contact.profilePictureUrl || '',
        notes: contact.metadata?.notes || '',
      });
    }
  }, [contact, form]);

  // Formatar número de telefone
  const formatPhoneDisplay = (value: string) => {
    const cleaned = value.replace(/\D/g, '');

    if (cleaned.startsWith('55') && cleaned.length > 2) {
      const withoutCountry = cleaned.substring(2);
      if (withoutCountry.length <= 2) {
        return `+55 (${withoutCountry}`;
      } else if (withoutCountry.length <= 7) {
        return `+55 (${withoutCountry.substring(0, 2)}) ${withoutCountry.substring(2)}`;
      } else if (withoutCountry.length <= 11) {
        return `+55 (${withoutCountry.substring(0, 2)}) ${withoutCountry.substring(2, 7)}-${withoutCountry.substring(7)}`;
      }
    }

    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remover caracteres não numéricos
    const cleaned = e.target.value.replace(/\D/g, '');
    form.setValue('phoneNumber', cleaned);
  };

  const handleSubmit = async (data: ContactFormData) => {
    try {
      // Preparar dados para envio
      const submitData = {
        ...data,
        // Converter strings vazias para undefined
        name: data.name || undefined,
        email: data.email || undefined,
        profilePictureUrl: data.profilePictureUrl || undefined,
        notes: data.notes || undefined,
      };

      await onSubmit(submitData);
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Número de Telefone */}
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Número de Telefone *
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="tel"
                  placeholder="5511999998888"
                  onChange={handlePhoneChange}
                  value={formatPhoneDisplay(field.value)}
                  disabled={isLoading || !!contact}
                  aria-label="Número de telefone"
                  autoComplete="tel"
                />
              </FormControl>
              <FormDescription>
                Formato: código do país + DDD + número (apenas dígitos)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Nome */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="João da Silva"
                  disabled={isLoading}
                  aria-label="Nome do contato"
                  autoComplete="name"
                />
              </FormControl>
              <FormDescription>
                Nome completo do contato (opcional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="joao@exemplo.com"
                  disabled={isLoading}
                  aria-label="Email do contato"
                  autoComplete="email"
                />
              </FormControl>
              <FormDescription>
                Endereço de email do contato (opcional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* URL da Foto */}
        <FormField
          control={form.control}
          name="profilePictureUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Foto de Perfil
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="url"
                  placeholder="https://exemplo.com/foto.jpg"
                  disabled={isLoading}
                  aria-label="URL da foto de perfil"
                />
              </FormControl>
              <FormDescription>
                URL da imagem de perfil (opcional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notas */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Adicione observações sobre este contato..."
                  rows={3}
                  disabled={isLoading}
                  aria-label="Observações sobre o contato"
                  className="resize-none"
                />
              </FormControl>
              <FormDescription>
                Notas internas sobre o contato (opcional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botões */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          )}

          <Button
            type="submit"
            disabled={isLoading || !form.formState.isValid}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {submitLabel}
              </>
            )}
          </Button>
        </div>

        {/* Indicador de modificações */}
        {form.formState.isDirty && !isLoading && (
          <p className="text-xs text-muted-foreground text-center">
            * Você tem alterações não salvas
          </p>
        )}
      </form>
    </Form>
  );
}