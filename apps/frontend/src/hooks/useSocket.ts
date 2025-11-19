import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { toast } from 'sonner';

// Socket.io URL - remove /api do final se existir
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.botreserva.com.br';
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
  'conversation:status': (data: { conversationId: string; status: string }) => void;
  'user:typing': (data: { conversationId: string; userId: string; isTyping: boolean }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  'queue:updated': (data: any) => void;
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
      console.log('No auth token found, skipping socket connection');
      setError('Token de autenticação não encontrado');
      return null;
    }

    // Se já está conectado, não reconectar
    if (socketRef.current?.connected) {
      console.log('Socket already connected');
      return socketRef.current;
    }

    console.log('Connecting to socket server:', SOCKET_URL);
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
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      setConnectionStatus('connected');
      setError(null);
      reconnectAttemptsRef.current = 0;

      // EXPOSE SOCKET GLOBALLY FOR DEBUGGING
      if (typeof window !== 'undefined') {
        (window as any).socket = socket;
        console.log('🔧 Socket exposed globally as window.socket for debugging');
      }

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
      console.log('❌ Socket disconnected:', reason);
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
      } else if (reason === 'io client disconnect') {
        // Client intentionally disconnected
        console.log('Client disconnected intentionally');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message);
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

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      toast.success('Reconectado ao servidor', {
        duration: 2000,
        position: 'bottom-right'
      });
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Socket reconnection attempt', attemptNumber);
      setConnectionStatus('connecting');

      if (attemptNumber === 1) {
        toast.info('Tentando reconectar...', {
          duration: 2000,
          position: 'bottom-right'
        });
      }
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed');
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
    socket.on('error', (error: any) => {
      console.error('Socket error:', error);
      if (error.message) {
        toast.error(error.message, {
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
      console.log('Disconnecting socket...');
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
      console.log('📤📤📤 EMIT SOCKET.IO:', {
        event,
        data,
        hasCallback: !!callback,
        socketId: socketRef.current.id,
        timestamp: new Date().toISOString()
      });

      if (callback) {
        socketRef.current.emit(event, data, callback);
      } else {
        socketRef.current.emit(event, data);
      }
      console.log(`✅ Evento ${event} emitido com sucesso`);
      return true;
    } else {
      console.error('❌❌❌ Socket não conectado, não pode emitir:', {
        event,
        data,
        socketExists: !!socketRef.current,
        isConnected: socketRef.current?.connected
      });
      return false;
    }
  }, []);

  // Enhanced on function with type safety
  const on = useCallback(<K extends keyof SocketEvents>(
    event: K | string,
    handler: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => {
    if (socketRef.current) {
      console.log('👂 Adding listener for event:', event);

      // Wrap handler to log when event is received
      const wrappedHandler = (...args: any[]) => {
        console.log(`🎯🎯🎯 EVENTO RECEBIDO [${event}]:`, {
          event,
          data: args[0],
          timestamp: new Date().toISOString(),
          socketId: socketRef.current?.id,
          isConnected: socketRef.current?.connected
        });
        return (handler as any)(...args);
      };

      socketRef.current.on(event as string, wrappedHandler as any);
      console.log(`✅ Listener registrado para: ${event}`);
    } else {
      console.error(`❌ Não foi possível adicionar listener para ${event} - socket não inicializado`);
    }
  }, []);

  // Enhanced off function
  const off = useCallback(<K extends keyof SocketEvents>(
    event: K | string,
    handler?: K extends keyof SocketEvents ? SocketEvents[K] : (...args: any[]) => void
  ) => {
    if (socketRef.current) {
      console.log('🔇 Removing listener for event:', event);
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
      console.log('👂 Adding one-time listener for event:', event);
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