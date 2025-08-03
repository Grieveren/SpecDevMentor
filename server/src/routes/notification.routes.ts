// @ts-nocheck
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { NotificationService } from '../services/notification.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validationMiddleware } from '../middleware/validation.middleware.js';

const router = Router();

// Initialize services (these would typically be injected)
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);
let notificationService: NotificationService;

// Initialize notification service with Socket.IO server
export const initializeNotificationRoutes = (io: SocketIOServer) => {
  notificationService = new NotificationService(prisma, redis, io);
  return router;
};

/**
 * Get user notifications
 */
router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('unreadOnly').optional().isBoolean().toBoolean(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { page, limit, unreadOnly } = req.query;

      const _result = await notificationService.getUserNotifications(userId, {
        page: page as number,
        limit: limit as number,
        unreadOnly: unreadOnly as boolean,
      });

      res.json({
        success: true,
        data: result,
      });
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
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
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
  authMiddleware,
  [param('id').isString().notEmpty()],
  validationMiddleware,
  async (req, res) => {
    try {
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
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
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
router.get('/settings', authMiddleware, async (req, res) => {
  try {
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
  authMiddleware,
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
  validationMiddleware,
  async (req, res) => {
    try {
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
  authMiddleware,
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
  validationMiddleware,
  async (req, res) => {
    try {
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