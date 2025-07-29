import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { HealthService } from '../services/health.service.js';

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('ioredis');

describe('HealthService', () => {
  let healthService: HealthService;
  let mockPrisma: unknown;
  let mockRedis: unknown;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn(),
      user: {
        count: vi.fn(),
      },
    };

    mockRedis = {
      ping: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      del: vi.fn(),
    };

    healthService = new HealthService(mockPrisma, mockRedis);
  });

  describe('getHealth', () => {
    it('should return basic health status', async () => {
      const health = await healthService.getHealth();

      expect(health).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });

  describe('getDetailedHealth', () => {
    it('should return detailed health status when all services are healthy', async () => {
      // Mock successful database check
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.user.count.mockResolvedValue(10);

      // Mock successful Redis check
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test');
      mockRedis.del.mockResolvedValue(1);

      const health = await healthService.getDetailedHealth();

      expect(health.status).toBe('pass');
      expect(health.checks).toHaveProperty('database');
      expect(health.checks).toHaveProperty('redis');
      expect(health.checks).toHaveProperty('memory');
      expect(health.checks).toHaveProperty('disk');
      expect(health.checks).toHaveProperty('external');
      expect(health.checks.database.status).toBe('pass');
      expect(health.checks.redis.status).toBe('pass');
    });

    it('should return fail status when database is down', async () => {
      // Mock database failure
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      // Mock successful Redis check
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test');
      mockRedis.del.mockResolvedValue(1);

      const health = await healthService.getDetailedHealth();

      expect(health.status).toBe('fail');
      expect(health.checks.database.status).toBe('fail');
      expect(health.notes).toContain('Database connection failed');
    });

    it('should return fail status when Redis is down', async () => {
      // Mock successful database check
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.user.count.mockResolvedValue(10);

      // Mock Redis failure
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const health = await healthService.getDetailedHealth();

      expect(health.status).toBe('fail');
      expect(health.checks.redis.status).toBe('fail');
      expect(health.notes).toContain('Redis connection failed');
    });

    it('should return warn status for slow database queries', async () => {
      // Mock slow database query
      mockPrisma.$queryRaw.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([{ '?column?': 1 }]), 1500))
      );
      mockPrisma.user.count.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(10), 1500))
      );

      // Mock successful Redis check
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test');
      mockRedis.del.mockResolvedValue(1);

      const health = await healthService.getDetailedHealth();

      expect(health.status).toBe('warn');
      expect(health.checks.database.status).toBe('warn');
      expect(health.notes).toContain('Database performance degraded');
    });
  });

  describe('checkStartup', () => {
    it('should return true when all critical services are available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockResolvedValue('PONG');

      const _result = await healthService.checkStartup();

      expect(result).toBe(true);
    });

    it('should return false when database is not available', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection failed'));
      mockRedis.ping.mockResolvedValue('PONG');

      const _result = await healthService.checkStartup();

      expect(result).toBe(false);
    });

    it('should return false when Redis is not available', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const _result = await healthService.checkStartup();

      expect(result).toBe(false);
    });
  });

  describe('memory check', () => {
    it('should return pass status for normal memory usage', async () => {
      // Mock process.memoryUsage to return normal values
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 120 * 1024 * 1024, // 120MB
      });

      // Mock other services as healthy
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.user.count.mockResolvedValue(10);
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test');
      mockRedis.del.mockResolvedValue(1);

      const health = await healthService.getDetailedHealth();

      expect(health.checks.memory.status).toBe('pass');
      expect(health.checks.memory.details.usagePercent).toBe(50);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should return warn status for high memory usage', async () => {
      // Mock process.memoryUsage to return high values
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 75 * 1024 * 1024, // 75MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 120 * 1024 * 1024, // 120MB
      });

      // Mock other services as healthy
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.user.count.mockResolvedValue(10);
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test');
      mockRedis.del.mockResolvedValue(1);

      const health = await healthService.getDetailedHealth();

      expect(health.checks.memory.status).toBe('warn');
      expect(health.checks.memory.details.usagePercent).toBe(75);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    it('should return fail status for critical memory usage', async () => {
      // Mock process.memoryUsage to return critical values
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 90 * 1024 * 1024, // 90MB
        heapTotal: 100 * 1024 * 1024, // 100MB
        external: 10 * 1024 * 1024, // 10MB
        rss: 120 * 1024 * 1024, // 120MB
      });

      // Mock other services as healthy
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.user.count.mockResolvedValue(10);
      mockRedis.ping.mockResolvedValue('PONG');
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue('test');
      mockRedis.del.mockResolvedValue(1);

      const health = await healthService.getDetailedHealth();

      expect(health.status).toBe('fail');
      expect(health.checks.memory.status).toBe('fail');
      expect(health.checks.memory.details.usagePercent).toBe(90);
      expect(health.notes).toContain('Memory usage critical');

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });
});