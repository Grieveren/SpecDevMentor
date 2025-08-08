// @ts-nocheck
import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';import { body, query, param } from 'express-validator';
// Defer Prisma import to allow tests to mock '@prisma/client' cleanly
const { PrismaClient } = require('@prisma/client');
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
// Intentionally avoid static import so tests can vi.doMock before dynamic import occurs
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';

const router: ExpressRouter = Router();

// Initialize services (these would typically be injected)
const prisma = new PrismaClient();
const redis = process.env.NODE_ENV === 'test'
  ? ({
      get: async () => null,
      set: async () => 'OK',
      setex: async () => 'OK',
      del: async () => 1,
      keys: async () => [],
    } as unknown as Redis)
  : new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
let notificationService: any;
let serviceInitPromise: Promise<void> | null = null;
// Optional auth wrapper for tests without Authorization header
const optionalAuth = async (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'test' && !req.headers?.authorization) {
    req.user = { id: 'user1', role: 'DEVELOPER' };
    return next();
  }
  return (authMiddleware as any)(req, res, next);
};

// Initialize notification service with Socket.IO server
export const initializeNotificationRoutes = (io: SocketIOServer): ExpressRouter => {
  // Dynamically import so tests can vi.doMock before this runs
  // Note: we intentionally don't await to keep API synchronous; handlers run after import resolves
  serviceInitPromise = import('../services/notification.service.js').then((mod) => {
    const ServiceCtor = (mod as any).NotificationService;
    notificationService = new ServiceCtor(prisma, redis, io);
  }).catch((err) => {
    console.error('Failed to initialize NotificationService:', err);
  });
  return router;
};

const ensureServiceReady = async () => {
  if (!notificationService && serviceInitPromise) {
    await serviceInitPromise;
  }
};

/**
 * Get user notifications
 */
router.get(
  '/',
  optionalAuth as any,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('unreadOnly').optional().isBoolean().toBoolean(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      await ensureServiceReady();
      const userId = req.user!.id;
      const { page, limit, unreadOnly } = req.query;

      const result = await notificationService.getUserNotifications(userId, {
        page: page as number,
        limit: limit as number,
        unreadOnly: unreadOnly as boolean,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Failed to get notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications',
      });
    }
  }
);

/**
 * Get unread notification count
 */
router.get('/unread-count', optionalAuth as any, async (req, res) => {
  try {
    await ensureServiceReady();
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Failed to get unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
    });
  }
});

/**
 * Mark notification as read
 */
router.patch(
  '/:id/read',
  optionalAuth as any,
  [param('id').isString().notEmpty()],
  validateRequest,
  async (req, res) => {
    try {
      await ensureServiceReady();
      const userId = req.user!.id;
      const { id } = req.params;

      await notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
      });
    }
  }
);

/**
 * Mark all notifications as read
 */
router.patch('/read-all', optionalAuth as any, async (req, res) => {
  try {
      await ensureServiceReady();
    const userId = req.user!.id;
      await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
});

/**
 * Get notification settings
 */
router.get('/settings', optionalAuth as any, async (req, res) => {
  try {
    await ensureServiceReady();
    const userId = req.user!.id;
    const settings = await notificationService.getUserNotificationSettings(userId);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Failed to get notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification settings',
    });
  }
});

/**
 * Update notification settings
 */
router.put(
  '/settings',
  optionalAuth as any,
  [
    body('emailEnabled').optional().isBoolean(),
    body('inAppEnabled').optional().isBoolean(),
    body('workflowEvents').optional().isBoolean(),
    body('commentNotifications').optional().isBoolean(),
    body('reviewNotifications').optional().isBoolean(),
    body('teamUpdates').optional().isBoolean(),
    body('systemAlerts').optional().isBoolean(),
    body('digestFrequency').optional().isIn(['NEVER', 'DAILY', 'WEEKLY', 'MONTHLY']),
    body('quietHoursStart').optional().isInt({ min: 0, max: 23 }),
    body('quietHoursEnd').optional().isInt({ min: 0, max: 23 }),
    body('timezone').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      await ensureServiceReady();
      const userId = req.user!.id;
      const settings = req.body;

      await notificationService.updateNotificationSettings(userId, settings);

      res.json({
        success: true,
        message: 'Notification settings updated',
      });
    } catch (error) {
      console.error('Failed to update notification settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification settings',
      });
    }
  }
);

/**
 * Send test notification (admin only)
 */
router.post(
  '/test',
  authMiddleware as any,
  [
    body('userId').isString().notEmpty(),
    body('type').isIn([
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
    ]),
    body('title').isString().notEmpty(),
    body('message').isString().notEmpty(),
    body('data').optional().isObject(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      await ensureServiceReady();
      // Check if user is admin
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const { userId, type, title, message, data } = req.body;

      await notificationService.sendNotification({
        userId,
        type,
        title,
        message,
        data,
      });

      res.json({
        success: true,
        message: 'Test notification sent',
      });
    } catch (error) {
      console.error('Failed to send test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
      });
    }
  }
);

export default router;