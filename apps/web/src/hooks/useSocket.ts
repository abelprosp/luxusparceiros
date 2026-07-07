'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export function useSocket(eventHandlers?: Record<string, (data: unknown) => void>) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    if (eventHandlers) {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.on(event, handler);
      });
    }

    return () => {
      if (eventHandlers) {
        Object.keys(eventHandlers).forEach((event) => {
          socket.off(event);
        });
      }
      socket.disconnect();
    };
  }, [eventHandlers]);

  const emit = (event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  };

  return { socket: socketRef.current, isConnected, emit };
}
