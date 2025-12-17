'use client';

import { useEffect, useCallback } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { EscalationReason } from '@/types';

const ESCALATION_REASON_LABELS: Record<EscalationReason, string> = {
  [EscalationReason.USER_REQUESTED]: 'Cliente solicitou atendente',
  [EscalationReason.AI_UNABLE]: 'IA nao conseguiu resolver',
  [EscalationReason.COMPLEX_QUERY]: 'Consulta complexa',
  [EscalationReason.COMPLAINT]: 'Reclamacao',
  [EscalationReason.SALES_OPPORTUNITY]: 'Oportunidade de venda',
  [EscalationReason.URGENCY]: 'Urgencia detectada',
  [EscalationReason.OTHER]: 'Outro motivo',
};

interface EscalationNotificationProviderProps {
  children: React.ReactNode;
}

export function EscalationNotificationProvider({ children }: EscalationNotificationProviderProps) {
  const { on, off, isConnected } = useSocket();
  const { playEscalationSound, initializeAudioContext } = useNotificationSound();

  // Inicializar audio context no primeiro clique do usuario
  useEffect(() => {
    const handleFirstInteraction = () => {
      initializeAudioContext();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [initializeAudioContext]);

  // Handler para novas escalacoes
  const handleEscalationNew = useCallback((data: { escalation: any; conversation: any }) => {
    const { escalation, conversation } = data;

    console.log('🚨 Nova escalacao recebida:', { escalation, conversation });

    // Tocar som de alerta
    playEscalationSound();

    // Mostrar toast com informacoes da escalacao
    const contactName = conversation?.contact?.name || conversation?.contact?.phoneNumber || 'Cliente';
    const reasonLabel = ESCALATION_REASON_LABELS[escalation?.reason as EscalationReason] || 'Escalacao';
    const hotelUnit = escalation?.hotelUnit || '';

    toast.warning(
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Nova Escalacao!</p>
          <p className="text-sm text-muted-foreground truncate">{contactName}</p>
          <p className="text-xs text-muted-foreground mt-1">{reasonLabel}</p>
          {hotelUnit && (
            <p className="text-xs text-blue-600 mt-0.5">{hotelUnit}</p>
          )}
        </div>
      </div>,
      {
        duration: 10000, // 10 segundos
        position: 'top-right',
        action: {
          label: 'Ver',
          onClick: () => {
            // Navegar para a conversa
            if (conversation?.id) {
              window.location.href = `/dashboard/conversations?selected=${conversation.id}`;
            }
          },
        },
      }
    );

    // Tambem mostrar notificacao do navegador se permitido
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Nova Escalacao!', {
        body: `${contactName} - ${reasonLabel}`,
        icon: '/favicon.ico',
        tag: `escalation-${escalation?.id}`,
      });
    }
  }, [playEscalationSound]);

  // Registrar listener de escalacao
  useEffect(() => {
    if (!isConnected) return;

    console.log('📡 Registrando listener para escalation:new');
    on('escalation:new', handleEscalationNew);

    return () => {
      console.log('📡 Removendo listener para escalation:new');
      off('escalation:new', handleEscalationNew);
    };
  }, [isConnected, on, off, handleEscalationNew]);

  // Solicitar permissao para notificacoes do navegador
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'default') {
      return;
    }

    // Aguardar interacao do usuario antes de solicitar
    const requestPermission = () => {
      Notification.requestPermission();
      document.removeEventListener('click', requestPermission);
    };

    // Solicitar apos 5 segundos de uso
    const timer = setTimeout(() => {
      document.addEventListener('click', requestPermission, { once: true });
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', requestPermission);
    };
  }, []);

  return <>{children}</>;
}
