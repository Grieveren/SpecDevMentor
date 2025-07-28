import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { HealthService } from '../services/health.service.js';
import { errorTracker } from '../services/error-tracking.service.js';
import { alertingService } from '../services/alerting.service.js';
import { logger } from '../services/logger.service.js';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const router = Router();

// Initialize services
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const healthService = new HealthService(prisma, redis);

// Basic health check (for load balancers)
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getHealth();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Detailed health check (for monitoring systems)
router.get('/health/detailed', async (_req: Request, res: Response) => {
  try {
    const health = await healthService.getDetailedHealth();
    
    // Set appropriate status code based on health
    const statusCode = health.status === 'pass' ? 200 : health.status === 'warn' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Detailed health check failed', { error: error.message });
    res.status(503).json({
      status: 'fail',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    const isReady = await healthService.checkStartup();
    
    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/health/live', async (_req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error tracking endpoints (protected)
router.get('/errors/stats',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const timeRange = req.query.timeRange ? {
        start: new Date(req.query.start as string),
        end: new Date(req.query.end as string),
      } : undefined;

      const stats = errorTracker.getErrorStats(timeRange);
      res.json(stats);
    } catch (error) {
      logger.error('Error getting error stats', { error: error.message });
      res.status(500).json({ error: 'Failed to get error statistics' });
    }
  }
);

router.get('/errors/:errorId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const error = errorTracker.getError(req.params.errorId);
      
      if (!error) {
        return res.status(404).json({ error: 'Error not found' });
      }
      
      res.json(error);
    } catch (error) {
      logger.error('Error getting error details', { error: error.message });
      res.status(500).json({ error: 'Failed to get error details' });
    }
  }
);

router.get('/errors/fingerprint/:fingerprint',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const errors = errorTracker.getErrorsByFingerprint(req.params.fingerprint);
      res.json(errors);
    } catch (error) {
      logger.error('Error getting errors by fingerprint', { error: error.message });
      res.status(500).json({ error: 'Failed to get errors by fingerprint' });
    }
  }
);

// Alert management endpoints (protected)
router.get('/alerts/stats',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const timeRange = req.query.timeRange ? {
        start: new Date(req.query.start as string),
        end: new Date(req.query.end as string),
      } : undefined;

      const stats = alertingService.getAlertStats(timeRange);
      res.json(stats);
    } catch (error) {
      logger.error('Error getting alert stats', { error: error.message });
      res.status(500).json({ error: 'Failed to get alert statistics' });
    }
  }
);

router.get('/alerts/active',
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const alerts = alertingService.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      logger.error('Error getting active alerts', { error: error.message });
      res.status(500).json({ error: 'Failed to get active alerts' });
    }
  }
);

router.get('/alerts/:alertId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const alert = alertingService.getAlert(req.params.alertId);
      
      if (!alert) {
        return res.status(404).json({ error: 'Alert not found' });
      }
      
      res.json(alert);
    } catch (error) {
      logger.error('Error getting alert details', { error: error.message });
      res.status(500).json({ error: 'Failed to get alert details' });
    }
  }
);

router.post('/alerts/:alertId/acknowledge',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const success = await alertingService.acknowledgeAlert(req.params.alertId, userId);
      
      if (!success) {
        return res.status(404).json({ error: 'Alert not found or already acknowledged' });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error acknowledging alert', { error: error.message });
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }
);

router.post('/alerts/:alertId/resolve',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const success = await alertingService.resolveAlert(req.params.alertId, userId);
      
      if (!success) {
        return res.status(404).json({ error: 'Alert not found or already resolved' });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error resolving alert', { error: error.message });
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  }
);

// Alert rules management
router.get('/alerts/rules',
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const rules = alertingService.getRules();
      res.json(rules);
    } catch (error) {
      logger.error('Error getting alert rules', { error: error.message });
      res.status(500).json({ error: 'Failed to get alert rules' });
    }
  }
);

router.post('/alerts/rules',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const rule = req.body;
      
      // Validate rule
      if (!rule.name || !rule.type || !rule.condition || !rule.severity) {
        return res.status(400).json({ error: 'Missing required rule fields' });
      }
      
      // Generate ID if not provided
      if (!rule.id) {
        rule.id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      alertingService.addRule(rule);
      res.status(201).json({ success: true, ruleId: rule.id });
    } catch (error) {
      logger.error('Error creating alert rule', { error: error.message });
      res.status(500).json({ error: 'Failed to create alert rule' });
    }
  }
);

router.delete('/alerts/rules/:ruleId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const success = alertingService.removeRule(req.params.ruleId);
      
      if (!success) {
        return res.status(404).json({ error: 'Rule not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting alert rule', { error: error.message });
      res.status(500).json({ error: 'Failed to delete alert rule' });
    }
  }
);

// System metrics endpoint
router.get('/metrics',
  authMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };
      
      res.json(metrics);
    } catch (error) {
      logger.error('Error getting system metrics', { error: error.message });
      res.status(500).json({ error: 'Failed to get system metrics' });
    }
  }
);

// Real-time monitoring via Server-Sent Events
router.get('/events',
  authMiddleware,
  async (req: Request, res: Response) => {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial health status
    try {
      const health = await healthService.getDetailedHealth();
      sendEvent({ type: 'health', data: health });
    } catch (error) {
      sendEvent({ type: 'error', data: { message: 'Failed to get health status' } });
    }

    // Listen for alerts
    const alertHandler = (alert: any) => {
      sendEvent({ type: 'alert', data: alert });
    };

    const errorHandler = (error: any) => {
      sendEvent({ type: 'error', data: error });
    };

    alertingService.on('alert', alertHandler);
    errorTracker.on('error', errorHandler);

    // Send periodic health updates
    const healthInterval = setInterval(async () => {
      try {
        const health = await healthService.getDetailedHealth();
        sendEvent({ type: 'health', data: health });
      } catch (error) {
        sendEvent({ type: 'error', data: { message: 'Failed to get health status' } });
      }
    }, 30000); // Every 30 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      alertingService.off('alert', alertHandler);
      errorTracker.off('error', errorHandler);
      clearInterval(healthInterval);
    });
  }
);

export default router;