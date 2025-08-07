import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { initializeNotificationRoutes } from '../routes/notification.routes.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

let response: any;

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('ioredis');
vi.mock('socket.io');
vi.mock('../middleware/auth.middleware.js');
vi.mock('../services/notification.service.js');

describe('Notification Routes', () => {
  let app: express.Application;
  let mockNotificationService: unknown;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock auth middleware
    (authMiddleware as any).mockImplementation((_req: unknown, _res: unknown, _next: unknown) => {
      req.user = { id: 'user1', role: 'DEVELOPER' };
      next();
    });

    // Mock notification service
    mockNotificationService = {
      getUserNotifications: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      getUserNotificationSettings: vi.fn(),
      updateNotificationSettings: vi.fn(),
      sendNotification: vi.fn(),
    };

    // Mock the service import
    vi.doMock('../services/notification.service.js', () => ({
      NotificationService: vi.fn().mockImplementation(() => mockNotificationService),
    }));

    const mockIo = {} as SocketIOServer;
    const router = initializeNotificationRoutes(mockIo);
    app.use('/api/notifications', router);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      const mockResponse = {
        notifications: [
          {
            id: 'notif1',
            type: 'COMMENT_ADDED',
            title: 'New Comment',
            message: 'Someone commented',
            isRead: false,
            createdAt: new Date(),
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        },
      };

      mockNotificationService.getUserNotifications.mockResolvedValue(mockResponse);

       response = await request(app)
        .get('/api/notifications')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResponse,
      });

      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith('user1', {
        page: undefined,
        limit: undefined,
        unreadOnly: undefined,
      });
    });

    it('should handle query parameters', async () => {
      mockNotificationService.getUserNotifications.mockResolvedValue({
        notifications: [],
        pagination: { page: 2, limit: 10, total: 0, pages: 0 },
      });

      await request(app)
        .get('/api/notifications?page=2&limit=10&unreadOnly=true')
        .expect(200);

      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith('user1', {
        page: 2,
        limit: 10,
        unreadOnly: true,
      });
    });

    it('should handle service errors', async () => {
      mockNotificationService.getUserNotifications.mockRejectedValue(new Error('Service error'));

       response = await request(app)
        .get('/api/notifications')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to get notifications',
      });
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

       response = await request(app)
        .get('/api/notifications/unread-count')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { count: 5 },
      });

      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith('user1');
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      mockNotificationService.markAsRead.mockResolvedValue();

       response = await request(app)
        .patch('/api/notifications/notif1/read')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Notification marked as read',
      });

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('notif1', 'user1');
    });

    it('should validate notification ID', async () => {
      await request(app)
        .patch('/api/notifications//read')
        .expect(404);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue();

       response = await request(app)
        .patch('/api/notifications/read-all')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'All notifications marked as read',
      });

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user1');
    });
  });

  describe('GET /api/notifications/settings', () => {
    it('should return notification settings', async () => {
      const mockSettings = {
        emailEnabled: true,
        inAppEnabled: true,
        workflowEvents: true,
        commentNotifications: true,
        reviewNotifications: true,
        teamUpdates: true,
        systemAlerts: true,
      };

      mockNotificationService.getUserNotificationSettings.mockResolvedValue(mockSettings);

       response = await request(app)
        .get('/api/notifications/settings')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSettings,
      });

      expect(mockNotificationService.getUserNotificationSettings).toHaveBeenCalledWith('user1');
    });
  });

  describe('PUT /api/notifications/settings', () => {
    it('should update notification settings', async () => {
      const settingsUpdate = {
        emailEnabled: false,
        workflowEvents: false,
      };

      mockNotificationService.updateNotificationSettings.mockResolvedValue();

       response = await request(app)
        .put('/api/notifications/settings')
        .send(settingsUpdate)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Notification settings updated',
      });

      expect(mockNotificationService.updateNotificationSettings).toHaveBeenCalledWith(
        'user1',
        settingsUpdate
      );
    });

    it('should validate settings data', async () => {
      await request(app)
        .put('/api/notifications/settings')
        .send({ emailEnabled: 'invalid' })
        .expect(400);
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test notification for admin users', async () => {
      // Mock admin user
      (authMiddleware as any).mockImplementation((_req: unknown, _res: unknown, _next: unknown) => {
        req.user = { id: 'admin1', role: 'ADMIN' };
        next();
      });

      const testNotification = {
        userId: 'user1',
        type: 'SYSTEM_ALERT',
        title: 'Test Notification',
        message: 'This is a test',
        data: { test: true },
      };

      mockNotificationService.sendNotification.mockResolvedValue();

       response = await request(app)
        .post('/api/notifications/test')
        .send(testNotification)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Test notification sent',
      });

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(testNotification);
    });

    it('should reject non-admin users', async () => {
      const testNotification = {
        userId: 'user1',
        type: 'SYSTEM_ALERT',
        title: 'Test Notification',
        message: 'This is a test',
      };

       response = await request(app)
        .post('/api/notifications/test')
        .send(testNotification)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        message: 'Admin access required',
      });

      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should validate test notification data', async () => {
      // Mock admin user
      (authMiddleware as any).mockImplementation((_req: unknown, _res: unknown, _next: unknown) => {
        req.user = { id: 'admin1', role: 'ADMIN' };
        next();
      });

      await request(app)
        .post('/api/notifications/test')
        .send({
          userId: 'user1',
          type: 'INVALID_TYPE',
          title: 'Test',
          message: 'Test',
        })
        .expect(400);
    });
  });
});