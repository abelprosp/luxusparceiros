import { io, Socket } from 'socket.io-client';
import { getAccessToken, WS_URL } from './api';

let socket: Socket | null = null;

export type SocketEventHandlers = {
  onDashboardUpdate?: (data: unknown) => void;
  onNotification?: (data: unknown) => void;
  onTicketMessage?: (data: unknown) => void;
  onSaleUpdate?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

export function connectSocket(handlers: SocketEventHandlers = {}): Socket {
  if (socket?.connected) return socket;

  const token = getAccessToken();

  socket = io(WS_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    handlers.onConnect?.();
  });

  socket.on('disconnect', () => {
    handlers.onDisconnect?.();
  });

  socket.on('dashboard:update', (data) => {
    handlers.onDashboardUpdate?.(data);
  });

  socket.on('notification', (data) => {
    handlers.onNotification?.(data);
  });

  socket.on('ticket:message', (data) => {
    handlers.onTicketMessage?.(data);
  });

  socket.on('sale:update', (data) => {
    handlers.onSaleUpdate?.(data);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

export function emitEvent(event: string, data?: unknown): void {
  socket?.emit(event, data);
}

export function subscribeToTicket(ticketId: string): void {
  socket?.emit('ticket:join', { ticketId });
}

export function unsubscribeFromTicket(ticketId: string): void {
  socket?.emit('ticket:leave', { ticketId });
}

export function subscribeToDashboard(): void {
  socket?.emit('dashboard:subscribe');
}

export function unsubscribeFromDashboard(): void {
  socket?.emit('dashboard:unsubscribe');
}
