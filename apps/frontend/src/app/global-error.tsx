'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Tentar reportar - pode falhar se o auth context nao estiver disponivel
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
        fetch(`${apiUrl}/api/audit-logs/client-error`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack?.substring(0, 5000),
            url: typeof window !== 'undefined' ? window.location.href : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          }),
        }).catch(() => {
          // Fire-and-forget
        });
      }
    } catch {
      // Silently fail - global error boundary pode nao ter contexto
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '24px',
              }}
            >
              !
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Erro Critico
            </h2>

            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Ocorreu um erro inesperado na aplicacao.
            </p>

            <p
              style={{
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#f87171',
                background: 'rgba(239,68,68,0.1)',
                padding: '0.75rem',
                borderRadius: '8px',
                wordBreak: 'break-all',
                marginBottom: '1.5rem',
              }}
            >
              {error.message}
            </p>

            <button
              onClick={reset}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #4f46e5)',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.875rem',
              }}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
