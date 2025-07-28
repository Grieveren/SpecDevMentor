import { apiClient } from './api.service';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  workflowEvents: boolean;
  commentNotifications: boolean;
  reviewNotifications: boolean;
  teamUpdates: boolean;
  systemAlerts: boolean;
  digestFrequency?: 'NEVER' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  quietHoursStart?: number;
  quietHoursEnd?: number;
  timezone?: string;
}

export type NotificationType =
  | 'WORKFLOW_EVENT'
  | 'COMMENT_ADDED'
  | 'COMMENT_RESOLVED'
  | 'REVIEW_REQUESTED'
  | 'REVIEW_COMPLETED'
  | 'PHASE_TRANSITION'
  | 'PROJECT_INVITATION'
  | 'TEAM_UPDATE'
  | 'AI_REVIEW_READY'
  | 'SYSTEM_ALERT'
  | 'REMINDER';

export interface NotificationListResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class NotificationService {
  /**
   * Get user notifications
   */
  async getNotifications(options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.unreadOnly) params.append('unreadOnly', 'true');

    const response = await apiClient.get(`/notifications?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data.data.count;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all');
  }

  /**
   * Get notification settings
   */
  async getSettings(): Promise<NotificationSettings> {
    const response = await apiClient.get('/notifications/settings');
    return response.data.data;
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    await apiClient.put('/notifications/settings', settings);
  }

  /**
   * Send test notification (admin only)
   */
  async sendTestNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<void> {
    await apiClient.post('/notifications/test', data);
  }
}

export const notificationService = new NotificationService();