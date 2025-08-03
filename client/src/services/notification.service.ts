// @ts-nocheck
import { BaseService, typedApiClient } from './api.service';

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

export class NotificationService extends BaseService {
  constructor() {
    super(typedApiClient);
  }

  /**
   * Get user notifications
   */
  async getNotifications(options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<NotificationListResponse> {
    try {
      const params: Record<string, string> = {};
      
      if (options.page) params.page = options.page.toString();
      if (options.limit) params.limit = options.limit.toString();
      if (options.unreadOnly) params.unreadOnly = 'true';

      const response = await this.apiClient.get<NotificationListResponse>('/notifications', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await this.apiClient.get<{ count: number }>('/notifications/unread-count');
      return this.validateResponse(response).count;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await this.apiClient.patch<void>(`/notifications/${notificationId}/read`);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      const response = await this.apiClient.patch<void>('/notifications/read-all');
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get notification settings
   */
  async getSettings(): Promise<NotificationSettings> {
    try {
      const response = await this.apiClient.get<NotificationSettings>('/notifications/settings');
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    try {
      const response = await this.apiClient.put<void>('/notifications/settings', settings);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
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
    try {
      const response = await this.apiClient.post<void>('/notifications/test', data);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export const notificationService = new NotificationService();