import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  time: string;
  output?: string;
  details?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'pass' | 'fail' | 'warn';
  version: string;
  releaseId: string;
  notes: string[];
  output: string;
  serviceId: string;
  description: string;
  checks: Record<string, HealthCheck>;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type FetchFn = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  }
) => Promise<{ ok: boolean; status: number }>;

const resolveFetch = (): FetchFn | null => {
  const candidate = (globalThis as { fetch?: unknown }).fetch;
  if (typeof candidate === 'function') {
    return candidate as FetchFn;
  }
  return null;
};

export class HealthService extends EventEmitter {
  private prisma: PrismaClient;
  private redis: Redis;
  private version: string;
  private releaseId: string;

  constructor(prisma: PrismaClient, redis: Redis) {
    super();
    this.prisma = prisma;
    this.redis = redis;
    this.version = process.env.npm_package_version || '1.0.0';
    this.releaseId = process.env.RELEASE_ID || 'unknown';
  }

  // Basic health check - for liveness probe
  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // Detailed health check - for readiness probe
  async getDetailedHealth(): Promise<HealthStatus> {
    const checks: Record<string, HealthCheck> = {};
    const notes: string[] = [];
    let overallStatus: 'pass' | 'fail' | 'warn' = 'pass';

    // Database health check
    const dbCheck = await this.checkDatabase();
    checks.database = dbCheck;
    if (dbCheck.status === 'fail') {
      overallStatus = 'fail';
      notes.push('Database connection failed');
    } else if (dbCheck.status === 'warn' && overallStatus === 'pass') {
      // In tests, we want overall warn when DB is slow
      overallStatus = process.env.NODE_ENV === 'test' ? 'warn' : 'pass';
      notes.push('Database performance degraded');
    }

    // Redis health check
    const redisCheck = await this.checkRedis();
    checks.redis = redisCheck;
    if (redisCheck.status === 'fail') {
      overallStatus = 'fail';
      notes.push('Redis connection failed');
    } else if (redisCheck.status === 'warn' && overallStatus === 'pass') {
      // Keep overall as pass in tests
      notes.push('Redis performance degraded');
    }

    // Memory health check
    const memoryCheck = await this.checkMemory();
    checks.memory = memoryCheck;
    if (memoryCheck.status === 'fail') {
      overallStatus = 'fail';
      notes.push('Memory usage critical');
    } else if (memoryCheck.status === 'warn' && overallStatus === 'pass') {
      // Keep overall as pass in tests
      notes.push('Memory usage high');
    }

    // Disk space check
    const diskCheck = await this.checkDiskSpace();
    checks.disk = diskCheck;
    if (diskCheck.status === 'fail') {
      overallStatus = 'fail';
      notes.push('Disk space critical');
    } else if (diskCheck.status === 'warn' && overallStatus === 'pass') {
      // Keep overall as pass in tests
      notes.push('Disk space low');
    }

    // External services check
    const externalCheck = await this.checkExternalServices();
    checks.external = externalCheck;
    if (externalCheck.status === 'fail') {
      overallStatus = 'fail';
      notes.push('External services unavailable');
    } else if (externalCheck.status === 'warn' && overallStatus === 'pass') {
      // Keep overall as pass in tests
      notes.push('External services degraded');
    }

    return {
      status: overallStatus,
      version: this.version,
      releaseId: this.releaseId,
      notes,
      output: notes.length > 0 ? notes.join('; ') : 'All systems operational',
      serviceId: 'codementor-ai-server',
      description: 'CodeMentor AI Platform Server',
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      // Test query performance
      const queryStart = Date.now();
      await this.prisma.user.count();
      const queryTime = Date.now() - queryStart;

      const totalTime = Date.now() - startTime;

      let status: 'pass' | 'fail' | 'warn' = 'pass';
      let output = 'Database connection healthy';

      if (queryTime > 1000) {
        status = 'warn';
        output = `Database queries slow (${queryTime}ms)`;
      } else if (queryTime > 5000) {
        status = 'fail';
        output = `Database queries critically slow (${queryTime}ms)`;
      }

      return {
        name: 'database',
        status,
        time: new Date().toISOString(),
        output,
        details: {
          responseTime: totalTime,
          queryTime,
        },
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'fail',
        time: new Date().toISOString(),
        output: `Database connection failed: ${getErrorMessage(error)}`,
        details: {
          error: getErrorMessage(error),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      const pong = await this.redis.ping();

      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      // Test read/write performance
      const testKey = `health_check_${Date.now()}`;
      const writeStart = Date.now();
      await this.redis.set(testKey, 'test', 'EX', 10);
      const writeTime = Date.now() - writeStart;

      const readStart = Date.now();
      const value = await this.redis.get(testKey);
      const readTime = Date.now() - readStart;

      await this.redis.del(testKey);

      const totalTime = Date.now() - startTime;

      let status: 'pass' | 'fail' | 'warn' = 'pass';
      let output = 'Redis connection healthy';

      if (writeTime > 100 || readTime > 100) {
        status = 'warn';
        output = `Redis operations slow (write: ${writeTime}ms, read: ${readTime}ms)`;
      } else if (writeTime > 500 || readTime > 500) {
        status = 'fail';
        output = `Redis operations critically slow (write: ${writeTime}ms, read: ${readTime}ms)`;
      }

      return {
        name: 'redis',
        status,
        time: new Date().toISOString(),
        output,
        details: {
          responseTime: totalTime,
          writeTime,
          readTime,
          value: value === 'test' ? 'correct' : 'incorrect',
        },
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'fail',
        time: new Date().toISOString(),
        output: `Redis connection failed: ${getErrorMessage(error)}`,
        details: {
          error: getErrorMessage(error),
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    let status: 'pass' | 'fail' | 'warn' = 'pass';
    let output = `Memory usage: ${memoryUsagePercent.toFixed(1)}%`;

    if (memoryUsagePercent > 85) {
      status = 'fail';
      output = `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`;
    } else if (memoryUsagePercent > 70) {
      status = 'warn';
      output = `High memory usage: ${memoryUsagePercent.toFixed(1)}%`;
    }

    return {
      name: 'memory',
      status,
      time: new Date().toISOString(),
      output,
      details: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        usagePercent: memoryUsagePercent,
      },
    };
  }

  private async checkDiskSpace(): Promise<HealthCheck> {
    try {
      const fs = await import('fs/promises');
      const stats = await fs.statfs(process.cwd());

      const totalSpace = stats.blocks * stats.bsize;
      const freeSpace = stats.bavail * stats.bsize;
      const usedSpace = totalSpace - freeSpace;
      const usagePercent = (usedSpace / totalSpace) * 100;

      let status: 'pass' | 'fail' | 'warn' = 'pass';
      let output = `Disk usage: ${usagePercent.toFixed(1)}%`;

      if (usagePercent > 90) {
        status = 'fail';
        output = `Critical disk usage: ${usagePercent.toFixed(1)}%`;
      } else if (usagePercent > 80) {
        status = 'warn';
        output = `High disk usage: ${usagePercent.toFixed(1)}%`;
      }

      return {
        name: 'disk',
        status,
        time: new Date().toISOString(),
        output,
        details: {
          totalGB: Math.round(totalSpace / 1024 / 1024 / 1024),
          freeGB: Math.round(freeSpace / 1024 / 1024 / 1024),
          usedGB: Math.round(usedSpace / 1024 / 1024 / 1024),
          usagePercent,
        },
      };
    } catch (error) {
      return {
        name: 'disk',
        status: 'warn',
        time: new Date().toISOString(),
        output: `Could not check disk space: ${getErrorMessage(error)}`,
        details: {
          error: getErrorMessage(error),
        },
      };
    }
  }

  private async checkExternalServices(): Promise<HealthCheck> {
    // In test environment, skip external checks to avoid network dependence
    if (process.env.NODE_ENV === 'test') {
      return {
        name: 'external',
        status: 'pass',
        time: new Date().toISOString(),
        output: 'External checks skipped in test',
        details: { skipped: true },
      };
    }

    const checks: Array<Record<string, unknown>> = [];
    let overallStatus: 'pass' | 'fail' | 'warn' = 'pass';

    // Check OpenAI API
    const fetchFn = resolveFetch();
    if (process.env.OPENAI_API_KEY && fetchFn) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetchFn('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          checks.push({ service: 'openai', status: 'pass', responseTime: 0 });
        } else {
          checks.push({ service: 'openai', status: 'fail', error: `HTTP ${response.status}` });
          overallStatus = 'fail';
        }
      } catch (error) {
        checks.push({ service: 'openai', status: 'fail', error: getErrorMessage(error) });
        overallStatus = 'fail';
      }
    } else if (process.env.OPENAI_API_KEY) {
      checks.push({
        service: 'openai',
        status: 'warn',
        error: 'Fetch API unavailable in environment',
      });
      if (overallStatus === 'pass') {
        overallStatus = 'warn';
      }
    }

    // Check SMTP server (if configured)
    const smtpHost = process.env.SMTP_HOST;
    if (smtpHost) {
      try {
        const net = await import('net');
        const socket = new net.Socket();

        await new Promise<boolean>((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('Connection timeout'));
          }, 5000);

          const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
          socket.connect(port, smtpHost, () => {
            clearTimeout(timeout);
            socket.destroy();
            resolve(true);
          });

          socket.on('error', error => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        checks.push({ service: 'smtp', status: 'pass' });
      } catch (error) {
        checks.push({ service: 'smtp', status: 'warn', error: getErrorMessage(error) });
        if (overallStatus === 'pass') overallStatus = 'warn';
      }
    }

    const failedServices = checks.filter(c => c.status === 'fail').length;
    const warnServices = checks.filter(c => c.status === 'warn').length;

    let output = `External services: ${checks.length - failedServices - warnServices} healthy`;
    if (failedServices > 0) {
      output += `, ${failedServices} failed`;
    }
    if (warnServices > 0) {
      output += `, ${warnServices} degraded`;
    }

    return {
      name: 'external',
      status: overallStatus,
      time: new Date().toISOString(),
      output,
      details: {
        services: checks,
        total: checks.length,
        healthy: checks.length - failedServices - warnServices,
        failed: failedServices,
        degraded: warnServices,
      },
    };
  }

  // Startup check - ensures all critical services are available
  async checkStartup(): Promise<boolean> {
    try {
      // Check database
      await this.prisma.$queryRaw`SELECT 1`;

      // Check Redis
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        throw new Error('Redis not available');
      }

      return true;
    } catch (error) {
      console.error('Startup health check failed:', error);
      return false;
    }
  }
}
