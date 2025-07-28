import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { AnalyticsService } from '../services/analytics.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validationMiddleware } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const analyticsService = new AnalyticsService(prisma, redis);

// Validation schemas
const trackActivitySchema = Joi.object({
  action: Joi.string().required(),
  resource: Joi.string().required(),
  resourceId: Joi.string().required(),
  metadata: Joi.object().optional(),
  duration: Joi.number().optional(),
  sessionId: Joi.string().optional(),
});

const workflowProgressSchema = Joi.object({
  projectId: Joi.string().required(),
  phase: Joi.string().valid('REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION').required(),
  action: Joi.string().valid('started', 'completed', 'review_cycle', 'quality_updated').required(),
  qualityScore: Joi.number().min(0).max(100).optional(),
  collaboratorCount: Joi.number().min(0).optional(),
  commentCount: Joi.number().min(0).optional(),
  revisionCount: Joi.number().min(0).optional(),
  aiSuggestionsApplied: Joi.number().min(0).optional(),
});

const timeRangeSchema = Joi.object({
  start: Joi.date().optional(),
  end: Joi.date().optional(),
});

const periodSchema = Joi.object({
  period: Joi.string().valid('daily', 'weekly', 'monthly').default('weekly'),
});

// Middleware to check if user has analytics access
const requireAnalyticsAccess = async (req: any, res: Response, next: any) => {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Team leads and admins can access analytics
  if (user.role === 'TEAM_LEAD' || user.role === 'ADMIN') {
    return next();
  }

  // For project-specific analytics, check if user is project owner or team member
  const projectId = req.params.projectId || req.query.projectId;
  if (projectId) {
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: user.id },
          { team: { some: { userId: user.id, status: 'ACTIVE' } } },
        ],
      },
    });

    if (project) {
      return next();
    }
  }

  return res.status(403).json({ error: 'Insufficient permissions for analytics access' });
};

// Track user activity
router.post('/activity', 
  authMiddleware,
  validationMiddleware(trackActivitySchema),
  async (req: any, res: Response) => {
    try {
      const { action, resource, resourceId, metadata, duration, sessionId } = req.body;
      const userId = req.user.id;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      await analyticsService.trackUserActivity({
        userId,
        action,
        resource,
        resourceId,
        metadata,
        duration,
        sessionId,
        ipAddress,
        userAgent,
      });

      res.status(201).json({ message: 'Activity tracked successfully' });
    } catch (error) {
      console.error('Error tracking activity:', error);
      res.status(500).json({ error: 'Failed to track activity' });
    }
  }
);

// Track workflow progress
router.post('/workflow-progress',
  authMiddleware,
  validationMiddleware(workflowProgressSchema),
  async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const workflowData = { ...req.body, userId };

      await analyticsService.trackWorkflowProgress(workflowData);

      res.status(201).json({ message: 'Workflow progress tracked successfully' });
    } catch (error) {
      console.error('Error tracking workflow progress:', error);
      res.status(500).json({ error: 'Failed to track workflow progress' });
    }
  }
);

// Get project analytics
router.get('/projects/:projectId',
  authMiddleware,
  requireAnalyticsAccess,
  validationMiddleware(timeRangeSchema, 'query'),
  async (req: any, res: Response) => {
    try {
      const { projectId } = req.params;
      const { start, end } = req.query;

      const timeRange = start && end ? { start: new Date(start), end: new Date(end) } : undefined;
      const analytics = await analyticsService.getProjectAnalytics(projectId, timeRange);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting project analytics:', error);
      res.status(500).json({ error: 'Failed to get project analytics' });
    }
  }
);

// Get team analytics
router.get('/teams/:projectId',
  authMiddleware,
  requireAnalyticsAccess,
  validationMiddleware(timeRangeSchema, 'query'),
  async (req: any, res: Response) => {
    try {
      const { projectId } = req.params;
      const { start, end } = req.query;

      const timeRange = start && end ? { start: new Date(start), end: new Date(end) } : undefined;
      const analytics = await analyticsService.getTeamAnalytics(projectId, timeRange);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting team analytics:', error);
      res.status(500).json({ error: 'Failed to get team analytics' });
    }
  }
);

// Get user analytics
router.get('/users/:userId?',
  authMiddleware,
  validationMiddleware(timeRangeSchema, 'query'),
  async (req: any, res: Response) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.id;
      const currentUserRole = req.user.role;

      // Users can only access their own analytics unless they're team leads or admins
      let userId = currentUserId;
      if (requestedUserId && requestedUserId !== currentUserId) {
        if (currentUserRole !== 'TEAM_LEAD' && currentUserRole !== 'ADMIN') {
          return res.status(403).json({ error: 'Cannot access other user analytics' });
        }
        userId = requestedUserId;
      }

      const { start, end } = req.query;
      const timeRange = start && end ? { start: new Date(start), end: new Date(end) } : undefined;
      const analytics = await analyticsService.getUserAnalytics(userId, timeRange);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting user analytics:', error);
      res.status(500).json({ error: 'Failed to get user analytics' });
    }
  }
);

// Calculate team performance metrics
router.post('/teams/:projectId/performance',
  authMiddleware,
  requireAnalyticsAccess,
  validationMiddleware(periodSchema),
  async (req: any, res: Response) => {
    try {
      const { projectId } = req.params;
      const { period } = req.body;

      const metrics = await analyticsService.calculateTeamPerformanceMetrics(projectId, period);

      res.json(metrics);
    } catch (error) {
      console.error('Error calculating team performance metrics:', error);
      res.status(500).json({ error: 'Failed to calculate team performance metrics' });
    }
  }
);

// Calculate skill development metrics
router.post('/users/:userId/skills',
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.id;
      const currentUserRole = req.user.role;

      // Users can only access their own skill metrics unless they're team leads or admins
      let userId = currentUserId;
      if (requestedUserId && requestedUserId !== currentUserId) {
        if (currentUserRole !== 'TEAM_LEAD' && currentUserRole !== 'ADMIN') {
          return res.status(403).json({ error: 'Cannot access other user skill metrics' });
        }
        userId = requestedUserId;
      }

      const skillMetrics = await analyticsService.calculateSkillDevelopment(userId);

      res.json(skillMetrics);
    } catch (error) {
      console.error('Error calculating skill development:', error);
      res.status(500).json({ error: 'Failed to calculate skill development' });
    }
  }
);

// Get system performance metrics (admin only)
router.get('/system/performance',
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const user = req.user;
      
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { metricType, start, end, limit = 100 } = req.query;

      const whereClause: any = {};
      if (metricType) {
        whereClause.metricType = metricType;
      }
      if (start || end) {
        whereClause.timestamp = {};
        if (start) whereClause.timestamp.gte = new Date(start);
        if (end) whereClause.timestamp.lte = new Date(end);
      }

      const metrics = await prisma.systemPerformanceMetrics.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit as string),
      });

      res.json(metrics);
    } catch (error) {
      console.error('Error getting system performance metrics:', error);
      res.status(500).json({ error: 'Failed to get system performance metrics' });
    }
  }
);

// Trigger metrics aggregation (admin only)
router.post('/aggregate',
  authMiddleware,
  validationMiddleware(periodSchema),
  async (req: any, res: Response) => {
    try {
      const user = req.user;
      
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { period } = req.body;

      await analyticsService.aggregateMetrics(period);

      res.json({ message: `Metrics aggregated successfully for period: ${period}` });
    } catch (error) {
      console.error('Error aggregating metrics:', error);
      res.status(500).json({ error: 'Failed to aggregate metrics' });
    }
  }
);

// Get analytics dashboard summary
router.get('/dashboard/:projectId?',
  authMiddleware,
  requireAnalyticsAccess,
  async (req: any, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      let dashboardData: any = {};

      if (projectId) {
        // Project-specific dashboard
        const [projectAnalytics, teamAnalytics] = await Promise.all([
          analyticsService.getProjectAnalytics(projectId),
          analyticsService.getTeamAnalytics(projectId),
        ]);

        dashboardData = {
          type: 'project',
          projectId,
          project: projectAnalytics,
          team: teamAnalytics,
        };
      } else {
        // User dashboard
        const userAnalytics = await analyticsService.getUserAnalytics(userId);
        
        dashboardData = {
          type: 'user',
          userId,
          user: userAnalytics,
        };
      }

      res.json(dashboardData);
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }
);

// Get real-time metrics from Redis
router.get('/realtime',
  authMiddleware,
  async (req: any, res: Response) => {
    try {
      const user = req.user;
      
      if (user.role !== 'TEAM_LEAD' && user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const keys = await redis.keys('analytics:realtime:*');
      const realTimeMetrics: Record<string, number> = {};

      for (const key of keys) {
        const value = await redis.get(key);
        const metricName = key.replace('analytics:realtime:', '');
        realTimeMetrics[metricName] = parseInt(value || '0');
      }

      res.json(realTimeMetrics);
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      res.status(500).json({ error: 'Failed to get real-time metrics' });
    }
  }
);

export default router;