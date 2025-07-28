import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorTracker } from '../services/error-tracking.service.js';

describe('ErrorTrackingService', () => {
  beforeEach(() => {
    errorTracker.clearErrors();
  });

  describe('captureError', () => {
    it('should capture and store error', () => {
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        method: 'GET',
        url: '/api/test',
      };

      const errorId = errorTracker.captureError(error, context);

      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);

      const storedError = errorTracker.getError(errorId);
      expect(storedError).toBeDefined();
      expect(storedError?.error.name).toBe('Error');
      expect(storedError?.error.message).toBe('Test error');
      expect(storedError?.context.userId).toBe('user123');
      expect(storedError?.context.method).toBe('GET');
      expect(storedError?.context.url).toBe('/api/test');
    });

    it('should determine correct severity for different error types', () => {
      const databaseError = new Error('Database connection failed');
      databaseError.name = 'DatabaseError';
      const dbErrorId = errorTracker.captureError(databaseError);
      const dbError = errorTracker.getError(dbErrorId);
      expect(dbError?.severity).toBe('critical');

      const authError = new Error('Unauthorized access');
      authError.name = 'AuthError';
      const authErrorId = errorTracker.captureError(authError);
      const authErrorObj = errorTracker.getError(authErrorId);
      expect(authErrorObj?.severity).toBe('high');

      const validationError = new Error('Invalid input');
      validationError.name = 'ValidationError';
      const valErrorId = errorTracker.captureError(validationError);
      const valError = errorTracker.getError(valErrorId);
      expect(valError?.severity).toBe('medium');

      const genericError = new Error('Something went wrong');
      const genErrorId = errorTracker.captureError(genericError);
      const genError = errorTracker.getError(genErrorId);
      expect(genError?.severity).toBe('low');
    });

    it('should generate consistent fingerprints for similar errors', () => {
      const error1 = new Error('Test error');
      const error2 = new Error('Test error');

      const errorId1 = errorTracker.captureError(error1);
      const errorId2 = errorTracker.captureError(error2);

      const storedError1 = errorTracker.getError(errorId1);
      const storedError2 = errorTracker.getError(errorId2);

      expect(storedError1?.fingerprint).toBe(storedError2?.fingerprint);
    });

    it('should emit error event when error is captured', (done) => {
      const error = new Error('Test error');

      errorTracker.once('error', (errorReport) => {
        expect(errorReport.error.message).toBe('Test error');
        done();
      });

      errorTracker.captureError(error);
    });

    it('should emit criticalError event for critical errors', (done) => {
      const error = new Error('Database connection failed');
      error.name = 'DatabaseError';

      errorTracker.once('criticalError', (errorReport) => {
        expect(errorReport.severity).toBe('critical');
        done();
      });

      errorTracker.captureError(error);
    });
  });

  describe('addBreadcrumb', () => {
    it('should add breadcrumb to tracking', () => {
      errorTracker.addBreadcrumb('User logged in', 'auth', 'info', { userId: 'user123' });
      errorTracker.addBreadcrumb('API request made', 'api', 'info', { endpoint: '/api/test' });

      const error = new Error('Test error');
      const errorId = errorTracker.captureError(error);
      const storedError = errorTracker.getError(errorId);

      expect(storedError?.breadcrumbs).toHaveLength(2);
      expect(storedError?.breadcrumbs[0].message).toBe('User logged in');
      expect(storedError?.breadcrumbs[0].category).toBe('auth');
      expect(storedError?.breadcrumbs[1].message).toBe('API request made');
      expect(storedError?.breadcrumbs[1].category).toBe('api');
    });

    it('should limit breadcrumbs to maximum count', () => {
      // Add more than max breadcrumbs
      for (let i = 0; i < 150; i++) {
        errorTracker.addBreadcrumb(`Breadcrumb ${i}`, 'test', 'info');
      }

      const error = new Error('Test error');
      const errorId = errorTracker.captureError(error);
      const storedError = errorTracker.getError(errorId);

      expect(storedError?.breadcrumbs.length).toBeLessThanOrEqual(100);
      // Should keep the most recent breadcrumbs
      expect(storedError?.breadcrumbs[storedError.breadcrumbs.length - 1].message).toBe('Breadcrumb 149');
    });
  });

  describe('getErrorStats', () => {
    it('should return correct error statistics', () => {
      const error1 = new Error('Database error');
      error1.name = 'DatabaseError';
      const error2 = new Error('Auth error');
      error2.name = 'AuthError';
      const error3 = new Error('Another database error');
      error3.name = 'DatabaseError';

      errorTracker.captureError(error1);
      errorTracker.captureError(error2);
      errorTracker.captureError(error3);

      const stats = errorTracker.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType.DatabaseError).toBe(2);
      expect(stats.errorsByType.AuthError).toBe(1);
      expect(stats.errorsBySeverity.critical).toBe(2); // Database errors are critical
      expect(stats.errorsBySeverity.high).toBe(1); // Auth errors are high
      expect(stats.recentErrors).toHaveLength(3);
      expect(stats.topErrors).toHaveLength(2); // 2 unique fingerprints
    });

    it('should filter errors by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Mock timestamps
      const originalDate = Date;
      global.Date = vi.fn(() => twoHoursAgo) as any;
      global.Date.now = vi.fn(() => twoHoursAgo.getTime());
      const error1 = new Error('Old error');
      errorTracker.captureError(error1);

      global.Date = vi.fn(() => now) as any;
      global.Date.now = vi.fn(() => now.getTime());
      const error2 = new Error('Recent error');
      errorTracker.captureError(error2);

      // Restore Date
      global.Date = originalDate;

      const stats = errorTracker.getErrorStats({
        start: oneHourAgo,
        end: now,
      });

      expect(stats.totalErrors).toBe(1);
      expect(stats.recentErrors[0].error.message).toBe('Recent error');
    });
  });

  describe('getErrorsByFingerprint', () => {
    it('should return errors with matching fingerprint', () => {
      const error1 = new Error('Same error');
      const error2 = new Error('Same error');
      const error3 = new Error('Different error');

      const errorId1 = errorTracker.captureError(error1);
      const errorId2 = errorTracker.captureError(error2);
      errorTracker.captureError(error3);

      const storedError1 = errorTracker.getError(errorId1);
      const fingerprint = storedError1?.fingerprint;

      const matchingErrors = errorTracker.getErrorsByFingerprint(fingerprint!);

      expect(matchingErrors).toHaveLength(2);
      expect(matchingErrors[0].error.message).toBe('Same error');
      expect(matchingErrors[1].error.message).toBe('Same error');
    });
  });

  describe('captureRequestError', () => {
    it('should capture error with request context', () => {
      const error = new Error('Request error');
      const mockReq = {
        user: { id: 'user123' },
        requestId: 'req123',
        method: 'POST',
        originalUrl: '/api/test',
        get: vi.fn((header: string) => {
          if (header === 'User-Agent') return 'Mozilla/5.0';
          return undefined;
        }),
        ip: '127.0.0.1',
      };

      const errorId = errorTracker.captureRequestError(error, mockReq as any);
      const storedError = errorTracker.getError(errorId);

      expect(storedError?.context.userId).toBe('user123');
      expect(storedError?.context.requestId).toBe('req123');
      expect(storedError?.context.method).toBe('POST');
      expect(storedError?.context.url).toBe('/api/test');
      expect(storedError?.context.userAgent).toBe('Mozilla/5.0');
      expect(storedError?.context.ip).toBe('127.0.0.1');
    });
  });
});