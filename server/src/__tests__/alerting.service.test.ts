import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertingService } from '../services/alerting.service.js';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransporter: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-id' }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  },
}));

describe('AlertingService', () => {
  beforeEach(() => {
    // Clear all alerts before each test
    const alerts = alertingService.getActiveAlerts();
    alerts.forEach(alert => {
      alertingService.resolveAlert(alert.id);
    });
  });

  describe('createAlert', () => {
    it('should create and store alert', async () => {
      const alertId = await alertingService.createAlert(
        'error',
        'high',
        'Test Alert',
        'This is a test alert',
        'test-service',
        { key: 'value' }
      );

      expect(alertId).toMatch(/^alert_\d+_[a-z0-9]+$/);

      const alert = alertingService.getAlert(alertId);
      expect(alert).toBeDefined();
      expect(alert?.type).toBe('error');
      expect(alert?.severity).toBe('high');
      expect(alert?.title).toBe('Test Alert');
      expect(alert?.message).toBe('This is a test alert');
      expect(alert?.source).toBe('test-service');
      expect(alert?.status).toBe('active');
      expect(alert?.data).toEqual({ key: 'value' });
    });

    it('should emit alert event when alert is created', async () => {
      const promise = new Promise<void>((resolve) => {
        alertingService.once('alert', (alert) => {
          expect(alert.title).toBe('Test Alert');
          resolve();
        });
      });

      await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );
      await promise;
    });
  });

  describe('createErrorAlert', () => {
    it('should create alert from error report', async () => {
      const errorReport = {
        id: 'err123',
        timestamp: new Date(),
        error: {
          name: 'DatabaseError',
          message: 'Connection failed',
          stack: 'Error: Connection failed\n    at test.js:1:1',
        },
        context: {
          userId: 'user123',
          requestId: 'req123',
          method: 'GET',
          url: '/api/test',
          userAgent: 'Mozilla/5.0',
          ip: '127.0.0.1',
          environment: 'production',
          service: 'codementor-ai-server',
          version: '1.0.0',
        },
        fingerprint: 'abc123',
        severity: 'critical' as const,
        tags: ['error:database'],
        breadcrumbs: [],
      };

      const alertId = await alertingService.createErrorAlert(errorReport);
      const alert = alertingService.getAlert(alertId);

      expect(alert?.type).toBe('error');
      expect(alert?.severity).toBe('critical');
      expect(alert?.title).toBe('DatabaseError: Connection failed');
      expect(alert?.data.errorId).toBe('err123');
      expect(alert?.data.fingerprint).toBe('abc123');
      expect(alert?.data.userId).toBe('user123');
    });
  });

  describe('createPerformanceAlert', () => {
    it('should create performance alert with correct severity', async () => {
      const alertId = await alertingService.createPerformanceAlert(
        'response_time',
        1500,
        1000,
        'ms'
      );

      const alert = alertingService.getAlert(alertId);

      expect(alert?.type).toBe('performance');
      expect(alert?.severity).toBe('medium'); // 1.5x threshold
      expect(alert?.title).toBe('High response_time');
      expect(alert?.message).toContain('1500ms');
      expect(alert?.message).toContain('1000ms');
      expect(alert?.data.metric).toBe('response_time');
      expect(alert?.data.value).toBe(1500);
      expect(alert?.data.threshold).toBe(1000);
    });

    it('should create critical alert for very high values', async () => {
      const alertId = await alertingService.createPerformanceAlert(
        'response_time',
        3000,
        1000,
        'ms'
      );

      const alert = alertingService.getAlert(alertId);
      expect(alert?.severity).toBe('critical'); // 3x threshold
    });
  });

  describe('createHealthAlert', () => {
    it('should create health alert for service failure', async () => {
      const alertId = await alertingService.createHealthAlert(
        'database',
        'fail',
        'Connection timeout'
      );

      const alert = alertingService.getAlert(alertId);

      expect(alert?.type).toBe('health');
      expect(alert?.severity).toBe('critical');
      expect(alert?.title).toBe('database Health Check Failed');
      expect(alert?.message).toContain('Connection timeout');
      expect(alert?.data.service).toBe('database');
      expect(alert?.data.status).toBe('fail');
    });

    it('should create warning alert for service degradation', async () => {
      const alertId = await alertingService.createHealthAlert(
        'redis',
        'warn',
        'Slow response times'
      );

      const alert = alertingService.getAlert(alertId);

      expect(alert?.type).toBe('health');
      expect(alert?.severity).toBe('medium');
      expect(alert?.title).toBe('redis Health Check Warning');
    });
  });

  describe('createSecurityAlert', () => {
    it('should create security alert', async () => {
      const alertId = await alertingService.createSecurityAlert(
        'Failed login attempts',
        'high',
        { userId: 'user123', attempts: 5, ip: '192.168.1.1' }
      );

      const alert = alertingService.getAlert(alertId);

      expect(alert?.type).toBe('security');
      expect(alert?.severity).toBe('high');
      expect(alert?.title).toBe('Security Event: Failed login attempts');
      expect(alert?.data.userId).toBe('user123');
      expect(alert?.data.attempts).toBe(5);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge active alert', async () => {
      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );

      const success = await alertingService.acknowledgeAlert(alertId, 'user123');
      expect(success).toBe(true);

      const alert = alertingService.getAlert(alertId);
      expect(alert?.status).toBe('acknowledged');
      expect(alert?.acknowledgedBy).toBe('user123');
      expect(alert?.acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should not acknowledge non-existent alert', async () => {
      const success = await alertingService.acknowledgeAlert('nonexistent', 'user123');
      expect(success).toBe(false);
    });

    it('should not acknowledge already acknowledged alert', async () => {
      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );

      await alertingService.acknowledgeAlert(alertId, 'user123');
      const success = await alertingService.acknowledgeAlert(alertId, 'user456');
      expect(success).toBe(false);
    });

    it('should emit alertAcknowledged event', async () => {
      const promise = new Promise<void>((resolve) => {
        alertingService.once('alertAcknowledged', (alert) => {
          expect(alert.acknowledgedBy).toBe('user123');
          resolve();
        });
      });

      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );
      await alertingService.acknowledgeAlert(alertId, 'user123');
      await promise;
    });
  });

  describe('resolveAlert', () => {
    it('should resolve active alert', async () => {
      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );

      const success = await alertingService.resolveAlert(alertId, 'user123');
      expect(success).toBe(true);

      const alert = alertingService.getAlert(alertId);
      expect(alert?.status).toBe('resolved');
      expect(alert?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should resolve acknowledged alert', async () => {
      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );

      await alertingService.acknowledgeAlert(alertId, 'user123');
      const success = await alertingService.resolveAlert(alertId, 'user456');
      expect(success).toBe(true);

      const alert = alertingService.getAlert(alertId);
      expect(alert?.status).toBe('resolved');
    });

    it('should not resolve already resolved alert', async () => {
      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );

      await alertingService.resolveAlert(alertId, 'user123');
      const success = await alertingService.resolveAlert(alertId, 'user456');
      expect(success).toBe(false);
    });

    it('should emit alertResolved event', async () => {
      const promise = new Promise<void>((resolve) => {
        alertingService.once('alertResolved', (alert) => {
          expect(alert.status).toBe('resolved');
          resolve();
        });
      });

      const alertId = await alertingService.createAlert(
        'error',
        'medium',
        'Test Alert',
        'Test message',
        'test-service'
      );
      await alertingService.resolveAlert(alertId, 'user123');
      await promise;
    });
  });

  describe('getAlertStats', () => {
    it('should return correct alert statistics', async () => {
      await alertingService.createAlert('error', 'critical', 'Error 1', 'Message', 'service1');
      await alertingService.createAlert('error', 'high', 'Error 2', 'Message', 'service2');
      await alertingService.createAlert('performance', 'medium', 'Perf 1', 'Message', 'service3');

      const stats = alertingService.getAlertStats();

      expect(stats.totalAlerts).toBe(3);
      expect(stats.activeAlerts).toBe(3);
      expect(stats.alertsByType.error).toBe(2);
      expect(stats.alertsByType.performance).toBe(1);
      expect(stats.alertsBySeverity.critical).toBe(1);
      expect(stats.alertsBySeverity.high).toBe(1);
      expect(stats.alertsBySeverity.medium).toBe(1);
      expect(stats.recentAlerts).toHaveLength(3);
    });

    it('should filter alerts by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      await alertingService.createAlert('error', 'high', 'Recent Alert', 'Message', 'service');

      const stats = alertingService.getAlertStats({
        start: oneHourAgo,
        end: now,
      });

      expect(stats.totalAlerts).toBe(1);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return only active alerts', async () => {
      const alertId1 = await alertingService.createAlert('error', 'high', 'Alert 1', 'Message', 'service');
      const alertId2 = await alertingService.createAlert('error', 'medium', 'Alert 2', 'Message', 'service');
      const alertId3 = await alertingService.createAlert('error', 'low', 'Alert 3', 'Message', 'service');

      await alertingService.acknowledgeAlert(alertId2, 'user123');
      await alertingService.resolveAlert(alertId3, 'user123');

      const activeAlerts = alertingService.getActiveAlerts();

      expect(activeAlerts).toHaveLength(2); // alertId1 (active) and alertId2 (acknowledged)
      expect(activeAlerts.find(a => a.id === alertId1)?.status).toBe('active');
      expect(activeAlerts.find(a => a.id === alertId2)?.status).toBe('acknowledged');
      expect(activeAlerts.find(a => a.id === alertId3)).toBeUndefined();
    });
  });

  describe('alert rules', () => {
    it('should add and retrieve alert rules', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        type: 'error' as const,
        condition: 'severity = critical',
        threshold: 1,
        timeWindow: 5,
        severity: 'critical' as const,
        enabled: true,
        channels: [],
      };

      alertingService.addRule(rule);
      const rules = alertingService.getRules();

      expect(rules.find(r => r.id === 'test-rule')).toEqual(rule);
    });

    it('should remove alert rules', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        type: 'error' as const,
        condition: 'severity = critical',
        threshold: 1,
        timeWindow: 5,
        severity: 'critical' as const,
        enabled: true,
        channels: [],
      };

      alertingService.addRule(rule);
      const removed = alertingService.removeRule('test-rule');
      expect(removed).toBe(true);

      const rules = alertingService.getRules();
      expect(rules.find(r => r.id === 'test-rule')).toBeUndefined();
    });

    it('should return false when removing non-existent rule', () => {
      const removed = alertingService.removeRule('nonexistent');
      expect(removed).toBe(false);
    });
  });
});