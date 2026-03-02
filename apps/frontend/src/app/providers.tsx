'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { AuthProvider } from '@/contexts/auth-context';
import { SocketProvider } from '@/contexts/socket-context';
import { I18nProvider } from '@/i18n/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <SocketProvider>
            {children}
            <Toaster position="top-right" richColors />
            <ReactQueryDevtools initialIsOpen={false} />
          </SocketProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
