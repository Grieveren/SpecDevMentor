import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { notificationService, Notification } from '../services/notification.service';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_WS_URL || 'http://localhost:3001', {
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      // // // console.log('Connected to notification service');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      // // // console.log('Disconnected from notification service');
    });

    // Listen for real-time notifications
    newSocket.on('notification', (notification: {
      type: string;
      title: string;
      message: string;
      data: Record<string, any>;
      timestamp: string;
    }) => {
      // Add the new notification to the list
      const newNotification: Notification = {
        id: `temp-${Date.now()}`, // Temporary ID until we reload
        type: notification.type as any,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: false,
        createdAt: notification.timestamp,
      };

      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Show browser notification if permission is granted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
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
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Load initial notifications
  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  const loadNotifications = async (page = 1, append = false) => {
    try {
      setIsLoading(true);
      const _response = await notificationService.getNotifications({
        page,
        limit: 20,
      });

      if (append) {
        setNotifications(prev => [...prev, ...response.notifications]);
      } else {
        setNotifications(response.notifications);
      }

      setHasMore(page < response.pagination.pages);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
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
  }, [currentPage, hasMore, isLoading]);

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