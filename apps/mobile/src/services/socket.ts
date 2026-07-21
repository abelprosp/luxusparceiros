import { io, Socket } from 'socket.io-client';
import { getAccessToken, WS_URL } from './api';

let socket: Socket | null = null;
let handlers: SocketEventHandlers = {};

export type SocketEventHandlers = {
  onDashboardUpdate?: (data: unknown) => void;
  onNotification?: (data: unknown) => void;
  onTicketMessage?: (data: unknown) => void;
  onSaleUpdate?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

function attachHandlers(sock: Socket) {
  sock.off('connect');
  sock.off('disconnect');
  sock.off('dashboard:update');
  sock.off('notification:new');
  sock.off('notification');
  sock.off('ticket:message');
  sock.off('sale:updated');

  sock.on('connect', () => handlers.onConnect?.());
  sock.on('disconnect', () => handlers.onDisconnect?.());
  sock.on('dashboard:update', (data) => handlers.onDashboardUpdate?.(data));
  sock.on('notification:new', (data) => handlers.onNotification?.(data));
  sock.on('notification', (data) => handlers.onNotification?.(data));
  sock.on('ticket:message', (data) => handlers.onTicketMessage?.(data));
  sock.on('sale:updated', (data) => handlers.onSaleUpdate?.(data));
}

export function connectSocket(newHandlers: SocketEventHandlers = {}): Socket {
  handlers = { ...handlers, ...newHandlers };

  if (socket?.connected) {
    attachHandlers(socket);
    return socket;
  }

  const token = getAccessToken();

  socket = io(WS_URL, {
    transports: ['websocket'],
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  attachHandlers(socket);
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  handlers = {};
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
