// Defer Prisma import to be compatible with module mocks in tests
const { PrismaClient, NotificationType, EmailStatus, DigestFrequency } = require('@prisma/client');
// Import types separately so generated declarations reference public types
import type {
  PrismaClient as PrismaClientType,
  NotificationType as NotificationTypeEnum,
  EmailStatus as EmailStatusEnum,
  DigestFrequency as DigestFrequencyEnum,
} from '@prisma/client';
import nodemailer from 'nodemailer';
import { Redis } from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';
import { 
  NotificationServiceConfig, 
  ServiceError, 
  ServiceLifecycle, 
  ServiceHealthCheck, 
  ServiceMetrics 
} from '../types/services.js';

interface NotificationData {
  userId: string;
  type: NotificationTypeEnum;
  title: string;
  message: string;
  data?: Record<string, any>;
  expiresAt?: Date;
}

interface EmailNotificationData {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  scheduledAt?: Date;
}

interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  workflowEvents: boolean;
  commentNotifications: boolean;
  reviewNotifications: boolean;
  teamUpdates: boolean;
  systemAlerts: boolean;
}

export class NotificationService {
  private prisma: PrismaClientType;
  private redis: Redis;
  private io?: SocketIOServer;
  private emailTransporter: nodemailer.Transporter;

  constructor(prisma: PrismaClientType, redis: Redis, io?: SocketIOServer) {
    this.prisma = prisma;
    this.redis = redis;
    this.io = io;
    
    // Configure email transporter (support both createTransport and older mocked createTransporter)
    const transportConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    } as any;

    this.emailTransporter = ((nodemailer as any).createTransport
      ? (nodemailer as any).createTransport(transportConfig)
      : (nodemailer as any).createTransporter
        ? (nodemailer as any).createTransporter(transportConfig)
        : { sendMail: async () => {} }) as any;
  }

  /**
   * Send a notification to a user
   */
  async sendNotification(data: NotificationData): Promise<void> {
    try {
      // Get user's notification preferences
      const settings = await this.getUserNotificationSettings(data.userId);
      
      // Check if this type of notification is enabled
      if (!this.shouldSendNotification(data.type, settings)) {
        return;
      }

      // Create in-app notification if enabled
      if (settings.inAppEnabled) {
        await this.createInAppNotification(data);
      }

      // Send real-time notification via WebSocket
      if (this.io && settings.inAppEnabled) {
        await this.sendRealTimeNotification(data);
      }

      // Send email notification if enabled
      if (settings.emailEnabled) {
        await this.sendEmailNotification(data);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw new ServiceError('Failed to send notification', 'NOTIFICATION_ERROR', 'NotificationService');
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotification(userIds: string[], data: Omit<NotificationData, 'userId'>): Promise<void> {
    const notifications = userIds.map(userId => ({
      ...data,
      userId,
    }));

    await Promise.allSettled(
      notifications.map(notification => this.sendNotification(notification))
    );
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(data: NotificationData): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Send real-time notification via WebSocket
   */
  private async sendRealTimeNotification(data: NotificationData): Promise<void> {
    if (!this.io) return;

    this.io.to(`user:${data.userId}`).emit('notification', {
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      timestamp: new Date(),
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(data: NotificationData): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: { email: true, name: true },
      });

      if (!user) return;

      const emailData: EmailNotificationData = {
        to: user.email,
        subject: data.title,
        htmlContent: this.generateEmailHTML(data, user.name),
        textContent: this.generateEmailText(data, user.name),
      };

      await this.queueEmail(emailData);
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  /**
   * Queue email for sending
   */
  private async queueEmail(data: EmailNotificationData): Promise<void> {
    await this.prisma.emailQueue.create({
      data: {
        to: data.to,
        subject: data.subject,
        htmlContent: data.htmlContent,
        textContent: data.textContent,
        templateId: data.templateId,
        templateData: data.templateData || {},
        scheduledAt: data.scheduledAt || new Date(),
      },
    });
  }

  /**
   * Process email queue
   */
  async processEmailQueue(): Promise<void> {
    const pendingEmails = await this.prisma.emailQueue.findMany({
      where: {
        status: EmailStatus.PENDING,
        scheduledAt: { lte: new Date() },
        attempts: { lt: this.prisma.emailQueue.fields.maxAttempts },
      },
      take: 10, // Process 10 emails at a time
      orderBy: { scheduledAt: 'asc' },
    });

    for (const email of pendingEmails) {
      try {
        await this.prisma.emailQueue.update({
          where: { id: email.id },
          data: { status: EmailStatus.SENDING },
        });

        await this.emailTransporter.sendMail({
          to: email.to,
          subject: email.subject,
          html: email.htmlContent,
          text: email.textContent,
        });

        await this.prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: EmailStatus.SENT,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to send email ${email.id}:`, error);
        
        await this.prisma.emailQueue.update({
          where: { id: email.id },
          data: {
            status: email.attempts + 1 >= email.maxAttempts ? EmailStatus.FAILED : EmailStatus.PENDING,
            attempts: { increment: 1 },
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    } = {}
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
  }

  /**
   * Get or create user notification settings
   */
  async getUserNotificationSettings(userId: string): Promise<NotificationPreferences> {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: { userId },
      });
    }

    return {
      emailEnabled: settings.emailEnabled,
      inAppEnabled: settings.inAppEnabled,
      workflowEvents: settings.workflowEvents,
      commentNotifications: settings.commentNotifications,
      reviewNotifications: settings.reviewNotifications,
      teamUpdates: settings.teamUpdates,
      systemAlerts: settings.systemAlerts,
    };
  }

  /**
   * Update user notification settings
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationPreferences & {
      digestFrequency: DigestFrequencyEnum;
      quietHoursStart: number;
      quietHoursEnd: number;
      timezone: string;
    }>
  ): Promise<void> {
    await this.prisma.notificationSettings.upsert({
      where: { userId },
      create: {
        userId,
        ...settings,
      },
      update: settings,
    });
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  private shouldSendNotification(type: NotificationTypeEnum, settings: NotificationPreferences): boolean {
    switch (type) {
      case NotificationType.WORKFLOW_EVENT:
      case NotificationType.PHASE_TRANSITION:
        return settings.workflowEvents;
      
      case NotificationType.COMMENT_ADDED:
      case NotificationType.COMMENT_RESOLVED:
        return settings.commentNotifications;
      
      case NotificationType.REVIEW_REQUESTED:
      case NotificationType.REVIEW_COMPLETED:
      case NotificationType.AI_REVIEW_READY:
        return settings.reviewNotifications;
      
      case NotificationType.PROJECT_INVITATION:
      case NotificationType.TEAM_UPDATE:
        return settings.teamUpdates;
      
      case NotificationType.SYSTEM_ALERT:
        return settings.systemAlerts;
      
      default:
        return true;
    }
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(data: NotificationData, userName: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${data.title}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>CodeMentor AI</h1>
            </div>
            <div class="content">
              <h2>Hi ${userName},</h2>
              <h3>${data.title}</h3>
              <p>${data.message}</p>
              ${data.data?.actionUrl ? `<p><a href="${data.data.actionUrl}" class="button">View Details</a></p>` : ''}
            </div>
            <div class="footer">
              <p>This is an automated message from CodeMentor AI. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   */
  private generateEmailText(data: NotificationData, userName: string): string {
    return `
Hi ${userName},

${data.title}

${data.message}

${data.data?.actionUrl ? `View details: ${data.data.actionUrl}` : ''}

---
This is an automated message from CodeMentor AI.
    `.trim();
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<void> {
    await this.prisma.notification.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  /**
   * Send workflow event notifications
   */
  async sendWorkflowEventNotification(
    projectId: string,
    eventType: 'phase_transition' | 'document_updated' | 'review_completed',
    data: Record<string, any>
  ): Promise<void> {
    // Get project team members
    const project = await this.prisma.specificationProject.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        team: {
          where: { status: 'ACTIVE' },
          include: { user: true },
        },
      },
    });

    if (!project) return;

    const teamMembers = [project.owner, ...project.team.map(tm => tm.user)];
    const userIds = teamMembers.map(user => user.id);

    let title: string;
    let message: string;
    let notificationType: NotificationTypeEnum;

    switch (eventType) {
      case 'phase_transition':
        title = `Phase Transition in ${project.name}`;
        message = `The project has moved to the ${data.newPhase} phase.`;
        notificationType = NotificationType.PHASE_TRANSITION;
        break;
      
      case 'document_updated':
        title = `Document Updated in ${project.name}`;
        message = `The ${data.phase} document has been updated.`;
        notificationType = NotificationType.WORKFLOW_EVENT;
        break;
      
      case 'review_completed':
        title = `Review Completed in ${project.name}`;
        message = `A review has been completed for the ${data.phase} document.`;
        notificationType = NotificationType.REVIEW_COMPLETED;
        break;
      
      default:
        return;
    }

    await this.sendBulkNotification(userIds, {
      type: notificationType,
      title,
      message,
      data: {
        projectId,
        projectName: project.name,
        actionUrl: `${process.env.CLIENT_URL}/projects/${projectId}`,
        ...data,
      },
    });
  }
}