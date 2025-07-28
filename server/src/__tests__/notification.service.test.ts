import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from '../services/notification.service.js';

// Mock dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
  NotificationType: {
    WORKFLOW_EVENT: 'WORKFLOW_EVENT',
    COMMENT_ADDED: 'COMMENT_ADDED',
    COMMENT_RESOLVED: 'COMMENT_RESOLVED',
    REVIEW_REQUESTED: 'REVIEW_REQUESTED',
    REVIEW_COMPLETED: 'REVIEW_COMPLETED',
    PHASE_TRANSITION: 'PHASE_TRANSITION',
    PROJECT_INVITATION: 'PROJECT_INVITATION',
    TEAM_UPDATE: 'TEAM_UPDATE',
    AI_REVIEW_READY: 'AI_REVIEW_READY',
    SYSTEM_ALERT: 'SYSTEM_ALERT',
    REMINDER: 'REMINDER',
  },
  EmailStatus: {
    PENDING: 'PENDING',
    SENDING: 'SENDING',
    SENT: 'SENT',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(),
}));

vi.mock('socket.io', () => ({
  Server: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransporter: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockPrisma: any;
  let mockRedis: any;
  let mockIo: any;

  beforeEach(() => {
    mockPrisma = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      notificationSettings: {
        findUnique: vi.fn(),
        create: vi.fn(),
        upsert: vi.fn(),
      },
      emailQueue: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        fields: { maxAttempts: 3 },
      },
      user: {
        findUnique: vi.fn(),
      },
      specificationProject: {
        findUnique: vi.fn(),
      },
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    };

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    };

    notificationService = new NotificationService(mockPrisma, mockRedis, mockIo);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should create in-app notification when enabled', async () => {
      const notificationData = {
        userId: 'user1',
        type: 'WORKFLOW_EVENT' as any,
        title: 'Test Notification',
        message: 'This is a test notification',
        data: { projectId: 'project1' },
      };

      mockPrisma.notificationSettings.findUnique.mockResolvedValue({
        emailEnabled: true,
        inAppEnabled: true,
        workflowEvents: true,
        commentNotifications: true,
        reviewNotifications: true,
        teamUpdates: true,
        systemAlerts: true,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
      });

      await notificationService.sendNotification(notificationData);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          type: 'WORKFLOW_EVENT',
          title: 'Test Notification',
          message: 'This is a test notification',
          data: { projectId: 'project1' },
          expiresAt: undefined,
        },
      });
    });

    it('should send real-time notification via WebSocket', async () => {
      const notificationData = {
        userId: 'user1',
        type: 'COMMENT_ADDED' as any,
        title: 'New Comment',
        message: 'Someone commented on your document',
      };

      mockPrisma.notificationSettings.findUnique.mockResolvedValue({
        emailEnabled: false,
        inAppEnabled: true,
        workflowEvents: true,
        commentNotifications: true,
        reviewNotifications: true,
        teamUpdates: true,
        systemAlerts: true,
      });

      await notificationService.sendNotification(notificationData);

      expect(mockIo.to).toHaveBeenCalledWith('user:user1');
      expect(mockIo.emit).toHaveBeenCalledWith('notification', {
        type: 'COMMENT_ADDED',
        title: 'New Comment',
        message: 'Someone commented on your document',
        data: undefined,
        timestamp: expect.any(Date),
      });
    });

    it('should queue email notification when enabled', async () => {
      const notificationData = {
        userId: 'user1',
        type: 'REVIEW_COMPLETED' as any,
        title: 'Review Completed',
        message: 'Your document review is ready',
      };

      mockPrisma.notificationSettings.findUnique.mockResolvedValue({
        emailEnabled: true,
        inAppEnabled: true,
        workflowEvents: true,
        commentNotifications: true,
        reviewNotifications: true,
        teamUpdates: true,
        systemAlerts: true,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user1',
        email: 'test@example.com',
        name: 'Test User',
      });

      await notificationService.sendNotification(notificationData);

      expect(mockPrisma.emailQueue.create).toHaveBeenCalledWith({
        data: {
          to: 'test@example.com',
          subject: 'Review Completed',
          htmlContent: expect.stringContaining('Review Completed'),
          textContent: expect.stringContaining('Review Completed'),
          templateId: undefined,
          templateData: {},
          scheduledAt: expect.any(Date),
        },
      });
    });

    it('should not send notification when type is disabled', async () => {
      const notificationData = {
        userId: 'user1',
        type: 'WORKFLOW_EVENT' as any,
        title: 'Workflow Event',
        message: 'Phase transition occurred',
      };

      mockPrisma.notificationSettings.findUnique.mockResolvedValue({
        emailEnabled: true,
        inAppEnabled: true,
        workflowEvents: false, // Disabled
        commentNotifications: true,
        reviewNotifications: true,
        teamUpdates: true,
        systemAlerts: true,
      });

      await notificationService.sendNotification(notificationData);

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(mockIo.emit).not.toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [
        {
          id: 'notif1',
          type: 'COMMENT_ADDED',
          title: 'New Comment',
          message: 'Someone commented',
          isRead: false,
          createdAt: new Date(),
        },
      ];

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await notificationService.getUserNotifications('user1', {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        notifications: mockNotifications,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      });
    });

    it('should filter unread notifications when requested', async () => {
      await notificationService.getUserNotifications('user1', {
        unreadOnly: true,
      });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          isRead: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      await notificationService.markAsRead('notif1', 'user1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'notif1',
          userId: 'user1',
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      await notificationService.markAllAsRead('user1');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const count = await notificationService.getUnreadCount('user1');

      expect(count).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          isRead: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
      });
    });
  });

  describe('sendWorkflowEventNotification', () => {
    it('should send notification to all team members', async () => {
      const mockProject = {
        id: 'project1',
        name: 'Test Project',
        owner: { id: 'owner1', email: 'owner@example.com', name: 'Owner' },
        team: [
          {
            user: { id: 'member1', email: 'member1@example.com', name: 'Member 1' },
          },
          {
            user: { id: 'member2', email: 'member2@example.com', name: 'Member 2' },
          },
        ],
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.notificationSettings.findUnique.mockResolvedValue({
        emailEnabled: true,
        inAppEnabled: true,
        workflowEvents: true,
        commentNotifications: true,
        reviewNotifications: true,
        teamUpdates: true,
        systemAlerts: true,
      });

      const sendNotificationSpy = vi.spyOn(notificationService, 'sendNotification');
      sendNotificationSpy.mockResolvedValue();

      await notificationService.sendWorkflowEventNotification(
        'project1',
        'phase_transition',
        { newPhase: 'DESIGN' }
      );

      expect(sendNotificationSpy).toHaveBeenCalledTimes(3); // Owner + 2 members
      expect(sendNotificationSpy).toHaveBeenCalledWith({
        userId: 'owner1',
        type: 'PHASE_TRANSITION',
        title: 'Phase Transition in Test Project',
        message: 'The project has moved to the DESIGN phase.',
        data: {
          projectId: 'project1',
          projectName: 'Test Project',
          actionUrl: `${process.env.CLIENT_URL}/projects/project1`,
          newPhase: 'DESIGN',
        },
      });
    });
  });

  describe('processEmailQueue', () => {
    it('should process pending emails', async () => {
      const mockEmails = [
        {
          id: 'email1',
          to: 'test@example.com',
          subject: 'Test Email',
          htmlContent: '<p>Test</p>',
          textContent: 'Test',
          attempts: 0,
          maxAttempts: 3,
        },
      ];

      mockPrisma.emailQueue.findMany.mockResolvedValue(mockEmails);

      // Mock the email transporter
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({}),
      };

      // Replace the transporter in the service
      (notificationService as any).emailTransporter = mockTransporter;

      await notificationService.processEmailQueue();

      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email1' },
        data: { status: 'SENDING' },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Test Email',
        html: '<p>Test</p>',
        text: 'Test',
      });

      expect(mockPrisma.emailQueue.update).toHaveBeenCalledWith({
        where: { id: 'email1' },
        data: {
          status: 'SENT',
          sentAt: expect.any(Date),
        },
      });
    });
  });
});