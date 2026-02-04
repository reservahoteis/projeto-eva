import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { toast } from 'sonner';

// Socket.io URL - remove /api do final se existir
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const apiUrl: string = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.botreserva.com.br';
const SOCKET_URL = apiUrl.replace(/\/api\/?$/, '');

export interface UseSocketOptions {
  enabled?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  tenantSlug?: string;
}

export interface SocketEvents {
  'message:new': (data: any) => void;
  'message:status': (data: { messageId: string; status: 'sending' | 'sent' | 'delivered' | 'read' }) => void;
  'conversation:updated': (data: any) => void;
  'conversation:created': (data: any) => void;
  'conversation:new': (data: { conversation: any }) => void;
  'conversation:status': (data: { conversationId: string; status: string }) => void;
  'escalation:new': (data: { escalation: any; conversation: any }) => void;
  'user:typing': (data: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  'queue:updated': (data: any) => void;
  'contact:created': (data: { contact: any }) => void;
  'contact:updated': (data: { contact: any }) => void;
  'contact:deleted': (data: { contactId: string }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    enabled = true,
    reconnection = true,
    reconnectionAttempts = 10,
    reconnectionDelay = 1000,
    tenantSlug: propTenantSlug
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const reconnectAttemptsRef = useRef(0);

  // Função para conectar ao socket
  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') {
      return null;
    }

    // Get auth token and tenant slug
    const token = localStorage.getItem('accessToken');
    const tenantSlug = propTenantSlug || localStorage.getItem('tenantSlug') || 'hoteis-reserva';

    if (!token) {
      setError('Token de autenticação não encontrado');
      return null;
    }

    // Se já está conectado, não reconectar
    if (socketRef.current?.connected) {
      return socketRef.current;
    }

    setConnectionStatus('connecting');

    // Create socket connection with enhanced options
    socketRef.current = io(SOCKET_URL, {
      auth: {
        token,
        tenantSlug,
      },
      query: {
        token,
        tenantSlug
      },
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: true,
      path: '/socket.io/'
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Join tenant room
      socket.emit('join-tenant', { tenantSlug });

      // Show success notification
      toast.success('Conectado ao servidor em tempo real', {
        duration: 2000,
        position: 'bottom-right',
        className: 'bg-green-500 text-white'
      });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      setConnectionStatus('disconnected');

      if (reason === 'io server disconnect') {
        // Server forcefully disconnected
        toast.error('Desconectado do servidor', {
          duration: 3000,
          position: 'bottom-right'
        });
        // Try to reconnect
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      setIsConnected(false);
      setConnectionStatus('error');
      reconnectAttemptsRef.current++;

      // Show error notification only on first attempt
      if (reconnectAttemptsRef.current === 1) {
        toast.error('Erro ao conectar ao servidor em tempo real', {
          duration: 3000,
          position: 'bottom-right'
        });
      }
    });

    socket.on('reconnect', () => {
      toast.success('Reconectado ao servidor', {
        duration: 2000,
        position: 'bottom-right'
      });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      setConnectionStatus('connecting');

      if (attemptNumber === 1) {
        toast.info('Tentando reconectar...', {
          duration: 2000,
          position: 'bottom-right'
        });
      }
    });

    socket.on('reconnect_failed', () => {
      setConnectionStatus('error');
      toast.error('Falha ao reconectar. Por favor, recarregue a página.', {
        duration: 5000,
        position: 'bottom-right',
        action: {
          label: 'Recarregar',
          onClick: () => window.location.reload()
        }
      });
    });

    // Custom error handler
    socket.on('error', (socketError: { message?: string }) => {
      if (socketError.message) {
        toast.error(socketError.message, {
          duration: 3000,
          position: 'bottom-right'
        });
      }
    });

    return socket;
  }, [enabled, reconnection, reconnectionAttempts, reconnectionDelay, propTenantSlug]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  }, []);

  // Initialize connection
  useEffect(() => {
    const socket = connect();

    return () => {
      if (socket) {
        disconnect();
      }
    };
  }, [connect, disconnect]);

  // Enhanced emit function with connection check
  const emit = useCallback((event: string, data?: any, callback?: (...args: any[]) => void) => {
    if (socketRef.current && socketRef.current.connected) {
      if (callback) {
        socketRef.current.emit(event, data, callback);
      } else {
        socketRef.current.emit(event, data);
      }
      return true;
    }
    return false;
  }, []);

  // Enhanced on function with type safety
  const on = useCallback(<K extends keyof SocketEvents>(
    event: K | string,
    handler: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => {
    if (socketRef.current) {
      socketRef.current.on(event as string, handler as any);
    }
  }, []);

  // Enhanced off function
  const off = useCallback(<K extends keyof SocketEvents>(
    event: K | string,
    handler?: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event as string, handler as any);
      } else {
        socketRef.current.off(event as string);
      }
    }
  }, []);

  // Once listener
  const once = useCallback(<K extends keyof SocketEvents>(
    event: K | string,
    handler: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => {
    if (socketRef.current) {
      socketRef.current.once(event as string, handler as any);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    connectionStatus,
    error,
    emit,
    on,
    off,
    once,
    connect,
    disconnect,
  };
}
