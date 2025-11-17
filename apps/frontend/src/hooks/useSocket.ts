import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface UseSocketOptions {
  enabled?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { enabled = true, reconnectionAttempts = 5, reconnectionDelay = 1000 } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    // Get auth token and tenant slug
    const token = localStorage.getItem('accessToken');
    const tenantSlug = localStorage.getItem('tenantSlug') || 'hoteis-reserva';

    if (!token) {
      console.log('No auth token found, skipping socket connection');
      return;
    }

    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      auth: {
        token,
        tenantSlug,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts,
      reconnectionDelay,
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setIsConnected(true);
      setError(null);

      // Join tenant room
      socket.emit('join-tenant', { tenantSlug });
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setError(err.message);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [enabled, reconnectionAttempts, reconnectionDelay]);

  const emit = (event: string, data?: any) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  };

  const on = (event: string, handler: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  };

  const off = (event: string, handler?: (...args: any[]) => void) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event, handler);
      } else {
        socketRef.current.off(event);
      }
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off,
  };
}