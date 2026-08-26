'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { api, WS_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/toaster';
import {
  NotificationAlertModal,
  type NotificationAlertPayload,
} from '@/components/notifications/notification-alert-modal';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  data: NotificationItem[];
  unreadCount: number;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markSaleRemindersRead: (saleId: string) => Promise<void>;
  markRequestRemindersRead: (requestId: string) => Promise<void>;
}

const ALERT_EVENTS = new Set(['TASK_REMINDER', 'SALE_COMPLETED_BY_TASK']);

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function isAlertEvent(data?: Record<string, unknown> | null): boolean {
  const event = data?.event;
  return typeof event === 'string' && ALERT_EVENTS.has(event);
}

export function isTaskReminderNotification(
  notification: NotificationItem,
  target?: string | { saleId?: string; requestId?: string },
): boolean {
  if (notification.data?.event !== 'TASK_REMINDER') return false;
  if (!target) return true;
  if (typeof target === 'string') {
    return String(notification.data?.saleId ?? '') === target;
  }
  if (target.saleId) return String(notification.data?.saleId ?? '') === target.saleId;
  if (target.requestId) return String(notification.data?.requestId ?? '') === target.requestId;
  return true;
}

export function taskReminderText(notification: NotificationItem): string {
  return String(notification.data?.reminderMessage ?? '').trim();
}

export function getNotificationPath(data?: Record<string, unknown> | null): string | null {
  if (!data) return null;
  if (typeof data.path === 'string' && data.path.trim()) return data.path.trim();
  if (data.saleId) return `/vendas?sale=${encodeURIComponent(String(data.saleId))}`;
  if (data.ticketId) return `/chamados?ticket=${encodeURIComponent(String(data.ticketId))}`;
  if (data.commissionId) return '/comissoes';
  if (data.requestId) return `/solicitacoes?request=${encodeURIComponent(String(data.requestId))}`;
  return null;
}

function buildAlertPayload(notification: NotificationItem): NotificationAlertPayload | null {
  if (!isAlertEvent(notification.data)) return null;
  const path = getNotificationPath(notification.data) ?? '/vendas';
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    path,
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<NotificationAlertPayload | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const shownAlertIdsRef = useRef<Set<string>>(new Set());
  const initialAlertsCheckedRef = useRef(false);

  const showAlertIfNeeded = useCallback((notification: NotificationItem) => {
    if (shownAlertIdsRef.current.has(notification.id)) return;
    const payload = buildAlertPayload(notification);
    if (!payload) return;
    shownAlertIdsRef.current.add(notification.id);
    setAlert(payload);
  }, []);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await api<NotificationsResponse>('/notifications', {
        params: { limit: 30 },
      });
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);

      if (!initialAlertsCheckedRef.current) {
        initialAlertsCheckedRef.current = true;
        const unreadAlert = res.data.find((n) => !n.isRead && isAlertEvent(n.data));
        if (unreadAlert) showAlertIfNeeded(unreadAlert);
      }
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, showAlertIfNeeded]);

  const markAsRead = useCallback(async (id: string) => {
    await api(`/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await api('/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const markSaleRemindersRead = useCallback(async (saleId: string) => {
    const unread = notifications.filter((item) => !item.isRead && isTaskReminderNotification(item, saleId));
    if (!unread.length) return;
    await Promise.all(unread.map((item) => markAsRead(item.id)));
  }, [markAsRead, notifications]);

  const markRequestRemindersRead = useCallback(async (requestId: string) => {
    const unread = notifications.filter(
      (item) => !item.isRead && isTaskReminderNotification(item, { requestId }),
    );
    if (!unread.length) return;
    await Promise.all(unread.map((item) => markAsRead(item.id)));
  }, [markAsRead, notifications]);

  useEffect(() => {
    initialAlertsCheckedRef.current = false;
    shownAlertIdsRef.current = new Set();
    setAlert(null);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    const handleNew = (notification: NotificationItem) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
      setUnreadCount((c) => c + 1);
      toast({
        title: notification.title,
        description: notification.message,
      });
      showAlertIfNeeded(notification);
    };

    socket.on('notification:new', handleNew);
    socket.on('notification', handleNew);
    socket.on('notification:read', ({ id }: { id: string }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    });
    socket.on('notification:read-all', () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });

    return () => {
      socket.off('notification:new', handleNew);
      socket.off('notification', handleNew);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, toast, showAlertIfNeeded]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markAsRead,
      markAllAsRead,
      markSaleRemindersRead,
      markRequestRemindersRead,
    }),
    [
      notifications,
      unreadCount,
      loading,
      refresh,
      markAsRead,
      markAllAsRead,
      markSaleRemindersRead,
      markRequestRemindersRead,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <NotificationAlertModal
        alert={alert}
        onClose={() => setAlert(null)}
        onOpenSale={(path) => {
          setAlert(null);
          router.push(path);
        }}
      />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
