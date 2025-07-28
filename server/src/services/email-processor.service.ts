import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { NotificationService } from './notification.service.js';

export class EmailProcessorService {
  private notificationService: NotificationService;
  private isProcessing = false;
  private intervalId?: NodeJS.Timeout;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.notificationService = new NotificationService(prisma, redis);
  }

  /**
   * Start the email processor
   */
  start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      console.warn('Email processor is already running');
      return;
    }

    console.log(`Starting email processor with ${intervalMs}ms interval`);
    
    this.intervalId = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processEmails();
      }
    }, intervalMs);

    // Process immediately on start
    this.processEmails();
  }

  /**
   * Stop the email processor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('Email processor stopped');
    }
  }

  /**
   * Process pending emails
   */
  private async processEmails(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    
    try {
      await this.notificationService.processEmailQueue();
    } catch (error) {
      console.error('Error processing email queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get processor status
   */
  getStatus(): { isRunning: boolean; isProcessing: boolean } {
    return {
      isRunning: !!this.intervalId,
      isProcessing: this.isProcessing,
    };
  }
}