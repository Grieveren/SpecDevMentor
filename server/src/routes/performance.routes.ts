import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const performanceService = new PerformanceMonitoringService(prisma, redis);

// Validation schemas
const recordMetricSchema = Joi.object({
  metricType: Joi.string().required(),
  value: Joi.number().required(),
  unit: Joi.string().required(),
  tags: Joi.object().optional(),
});

const alertRuleSchema = Joi.object({
  name: Joi.string().required(),
  metricType: Joi.string().required(),
  condition: Joi.string().valid('greater_than', 'less_than', 'equals', 'not_equals').required(),
  threshold: Joi.number().required(),
  duration: Joi.number().min(60).required(), // Minimum 1 minute
  enabled: Joi.boolean().default(true),
  recipients: Joi.array().items(Joi.string().email()).required(),
  cooldownPeriod: Joi.number().min(300).default(1800), // Minimum 5 minutes, default 30 minutes
});

const updateAlertRuleSchema = Joi.object({
  name: Joi.string().optional(),
  condition: Joi.string().valid('greater_than', 'less_than', 'equals', 'not_equals').optional(),
  threshold: Joi.number().optional(),
  duration: Joi.number().min(60).optional(),
  enabled: Joi.boolean().optional(),
  recipients: Joi.array().items(Joi.string().email()).optional(),
  cooldownPeriod: Joi.number().min(300).optional(),
});

const reportSchema = Joi.object({
  period: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').default('daily'),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

// Middleware to check admin access
const requireAdminAccess = (req: any, res: Response, next: any) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Record a performance metric
router.post('/metrics',
  authMiddleware,
  requireAdminAccess,
  validationMiddleware(recordMetricSchema),
  async (req: Request, res: Response) => {
    try {
      const { metricType, value, unit, tags } = req.body;

      await performanceService.recordMetric({
        metricType,
        value,
        unit,
        tags,
      });

      res.status(201).json({ message: 'Metric recorded successfully' });
    } catch (error) {
      console.error('Error recording metric:', error);
      res.status(500).json({ error: 'Failed to record metric' });
    }
  }
);

// Get real-time metrics
router.get('/metrics/realtime',
  authMiddleware,
  requireAdminAccess,
  async (req: Request, res: Response) => {
    try {
      const { types } = req.query;
      const metricTypes = types ? (types as string).split(',') : undefined;

      const metrics = await performanceService.getRealTimeMetrics(metricTypes);

      res.json(metrics);
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      res.status(500).json({ error: 'Failed to get real-time metrics' });
    }
  }
);

// Get system health
router.get('/health',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const health = await performanceService.getSystemHealth();
      res.json(health);
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({ error: 'Failed to get system health' });
    }
  }
);

// Generate performance report
router.post('/reports',
  authMiddleware,
  requireAdminAccess,
  validationMiddleware(reportSchema),
  async (req: Request, res: Response) => {
    try {
      const { period, startDate, endDate } = req.body;

      const report = await performanceService.generatePerformanceReport(
        period,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      res.json(report);
    } catch (error) {
      console.error('Error generating performance report:', error);
      res.status(500).json({ error: 'Failed to generate performance report' });
    }
  }
);

// Alert rule management
router.post('/alerts/rules',
  authMiddleware,
  requireAdminAccess,
  validationMiddleware(alertRuleSchema),
  async (req: Request, res: Response) => {
    try {
      const rule = await performanceService.createAlertRule(req.body);
      res.status(201).json(rule);
    } catch (error) {
      console.error('Error creating alert rule:', error);
      res.status(500).json({ error: 'Failed to create alert rule' });
    }
  }
);

router.get('/alerts/rules',
  authMiddleware,
  requireAdminAccess,
  async (req: Request, res: Response) => {
    try {
      const rules = await performanceService.getAlertRules();
      res.json(rules);
    } catch (error) {
      console.error('Error getting alert rules:', error);
      res.status(500).json({ error: 'Failed to get alert rules' });
    }
  }
);

router.put('/alerts/rules/:id',
  authMiddleware,
  requireAdminAccess,
  validationMiddleware(updateAlertRuleSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rule = await performanceService.updateAlertRule(id, req.body);
      
      if (!rule) {
        return res.status(404).json({ error: 'Alert rule not found' });
      }

      res.json(rule);
    } catch (error) {
      console.error('Error updating alert rule:', error);
      res.status(500).json({ error: 'Failed to update alert rule' });
    }
  }
);

router.delete('/alerts/rules/:id',
  authMiddleware,
  requireAdminAccess,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await performanceService.deleteAlertRule(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Alert rule not found' });
      }

      res.json({ message: 'Alert rule deleted successfully' });
    } catch (error) {
      console.error('Error deleting alert rule:', error);
      res.status(500).json({ error: 'Failed to delete alert rule' });
    }
  }
);

// Active alerts management
router.get('/alerts',
  authMiddleware,
  requireAdminAccess,
  async (req: Request, res: Response) => {
    try {
      const alerts = await performanceService.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Error getting active alerts:', error);
      res.status(500).json({ error: 'Failed to get active alerts' });
    }
  }
);

router.post('/alerts/:id/acknowledge',
  authMiddleware,
  requireAdminAccess,
  async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const acknowledged = await performanceService.acknowledgeAlert(id, userId);
      
      if (!acknowledged) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ message: 'Alert acknowledged successfully' });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }
);

router.post('/alerts/:id/resolve',
  authMiddleware,
  requireAdminAccess,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const resolved = await performanceService.resolveAlert(id);
      
      if (!resolved) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ message: 'Alert resolved successfully' });
    } catch (error) {
      console.error('Error resolving alert:', error);
      res.status(500).json({ error: 'Failed to resolve alert' });
    }
  }
);

// WebSocket endpoint for real-time alerts (if using Socket.IO)
router.get('/alerts/stream',
  authMiddleware,
  requireAdminAccess,
  async (req: Request, res: Response) => {
    try {
      // Set up Server-Sent Events for real-time alerts
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Send initial health status
      const health = await performanceService.getSystemHealth();
      sendEvent({ type: 'health', data: health });

      // Listen for alerts
      const alertHandler = (alert: any) => {
        sendEvent({ type: 'alert', data: alert });
      };

      const healthHandler = (health: any) => {
        sendEvent({ type: 'health', data: health });
      };

      performanceService.on('alertTriggered', alertHandler);
      performanceService.on('alertResolved', alertHandler);
      performanceService.on('alertAcknowledged', alertHandler);

      // Send periodic health updates
      const healthInterval = setInterval(async () => {
        try {
          const health = await performanceService.getSystemHealth();
          sendEvent({ type: 'health', data: health });
        } catch (error) {
          console.error('Error sending health update:', error);
        }
      }, 30000); // Every 30 seconds

      // Clean up on client disconnect
      req.on('close', () => {
        performanceService.off('alertTriggered', alertHandler);
        performanceService.off('alertResolved', alertHandler);
        performanceService.off('alertAcknowledged', alertHandler);
        clearInterval(healthInterval);
      });

    } catch (error) {
      console.error('Error setting up alert stream:', error);
      res.status(500).json({ error: 'Failed to set up alert stream' });
    }
  }
);

// Middleware to record request metrics
export const requestMetricsMiddleware = (req: Request, res: Response, next: any) => {
  const startTime = Date.now();

  res.on('finish', async () => {
    try {
      const responseTime = Date.now() - startTime;
      const isError = res.statusCode >= 400;

      // Record response time
      await performanceService.recordMetric({
        metricType: 'response_time',
        value: responseTime,
        unit: 'milliseconds',
        tags: {
          method: req.method,
          route: req.route?.path || req.path,
          status: res.statusCode,
        },
      });

      // Record error rate
      if (isError) {
        await performanceService.recordMetric({
          metricType: 'error_rate',
          value: 1,
          unit: 'count',
          tags: {
            method: req.method,
            route: req.route?.path || req.path,
            status: res.statusCode,
          },
        });
      }

      // Record throughput
      await performanceService.recordMetric({
        metricType: 'throughput',
        value: 1,
        unit: 'requests',
        tags: {
          method: req.method,
          route: req.route?.path || req.path,
        },
      });

    } catch (error) {
      console.error('Error recording request metrics:', error);
    }
  });

  next();
};

export default router;