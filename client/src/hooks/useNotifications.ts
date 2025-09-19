import { useCallback, useEffect, useState } from 'react';
import { Socket, io } from 'socket.io-client';
import {
  Notification as AppNotification,
  NotificationType,
  notificationService,
} from '../services/notification.service';

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
}

interface RealtimeNotificationPayload {
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: string;
}

const asNotificationType = (value: string): NotificationType => {
  const allowed: NotificationType[] = [
    'WORKFLOW_EVENT',
    'COMMENT_ADDED',
    'COMMENT_RESOLVED',
    'REVIEW_REQUESTED',
    'REVIEW_COMPLETED',
    'PHASE_TRANSITION',
    'PROJECT_INVITATION',
    'TEAM_UPDATE',
    'AI_REVIEW_READY',
    'SYSTEM_ALERT',
    'REMINDER',
  ];

  return allowed.includes(value as NotificationType) ? (value as NotificationType) : 'SYSTEM_ALERT';
};

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = useCallback(async (page = 1, append = false) => {
    try {
      setIsLoading(true);
      const response = await notificationService.getNotifications({
        page,
        limit: 20,
      });

      setNotifications(prev =>
        append ? [...prev, ...response.notifications] : response.notifications
      );

      setHasMore(page < response.pagination.pages);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();

      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );

      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await loadNotifications(currentPage + 1, true);
    }
  }, [currentPage, hasMore, isLoading, loadNotifications]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io((import.meta.env.VITE_WS_URL as string) || 'http://localhost:3001', {
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('notification', (payload: RealtimeNotificationPayload) => {
      const newNotification: AppNotification = {
        id: `temp-${Date.now()}`,
        type: asNotificationType(payload.type),
        title: payload.title,
        message: payload.message,
        data: payload.data,
        isRead: false,
        createdAt: payload.timestamp,
      };

      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      if ('Notification' in window && window.Notification.permission === 'granted') {
        new window.Notification(payload.title, {
          body: payload.message,
          icon: '/favicon.ico',
        });
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && window.Notification.permission === 'default') {
      window.Notification.requestPermission();
    }
  }, []);

  // Load initial notifications
  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
    isLoading,
  };
};
