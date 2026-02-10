'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';
import { auditLogService } from '@/services/audit-log.service';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Reportar erro para o backend (fire-and-forget)
    auditLogService.reportClientError({
      message: error.message,
      stack: error.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }, [error]);

  return (
    <div className="p-4 md:p-6 lg:p-8 liquid-bg min-h-screen flex items-center justify-center">
      <div className="glass-card p-8 max-w-lg w-full text-center animate-fadeIn">
        <div className="icon-box icon-box-rose mx-auto mb-4 w-14 h-14">
          <AlertOctagon className="w-7 h-7 text-white" />
        </div>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          Erro na Pagina
        </h2>

        <p className="text-sm text-[var(--text-muted)] mb-4">
          Ocorreu um erro inesperado. A equipe foi notificada automaticamente.
        </p>

        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-6 text-left">
          <p className="text-xs font-mono text-red-400 break-all">
            {error.message}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/dashboard')}
            className="glass-btn"
          >
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>

        {error.digest && (
          <p className="text-[10px] text-[var(--text-muted)] mt-4 font-mono">
            Digest: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
