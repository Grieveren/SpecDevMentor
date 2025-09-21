import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import type { NextFunction, Request, Response, Router as ExpressRouter } from 'express';
import { Redis } from 'ioredis';
import Joi from 'joi';
import { AnalyticsServiceImpl } from '../services/analytics.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import type { ApiError, Middleware, TypedRequest } from '../types/express.js';
import type { ParamsDictionary } from 'express-serve-static-core';

const router: ExpressRouter = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const analyticsService = new AnalyticsServiceImpl(prisma, redis);

type EmptyParams = Record<string, never>;

type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

const ACTIVITY_TYPES = [
  'LOGIN',
  'LOGOUT',
  'PROJECT_CREATED',
  'PROJECT_UPDATED',
  'PROJECT_DELETED',
  'DOCUMENT_CREATED',
  'DOCUMENT_UPDATED',
  'DOCUMENT_VIEWED',
  'PHASE_TRANSITIONED',
  'COMMENT_CREATED',
  'COMMENT_UPDATED',
  'COMMENT_RESOLVED',
  'AI_REVIEW_REQUESTED',
  'AI_SUGGESTION_APPLIED',
  'TEMPLATE_APPLIED',
  'TEMPLATE_CREATED',
  'COLLABORATION_JOINED',
  'COLLABORATION_LEFT',
  'CODE_EXECUTED',
  'LEARNING_MODULE_STARTED',
  'LEARNING_MODULE_COMPLETED',
  'EXERCISE_COMPLETED',
] as const;

type ActivityTypeValue = (typeof ACTIVITY_TYPES)[number];

const SPECIFICATION_PHASES = ['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION'] as const;

type SpecificationPhaseValue = (typeof SPECIFICATION_PHASES)[number];

interface TrackActivityRequestBody {
  action: ActivityTypeValue;
  resource: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  duration?: number;
  sessionId?: string;
}

interface WorkflowProgressRequestBody {
  projectId: string;
  phase: SpecificationPhaseValue;
  action: 'started' | 'completed' | 'review_cycle' | 'quality_updated';
  qualityScore?: number;
  collaboratorCount?: number;
  commentCount?: number;
  revisionCount?: number;
  aiSuggestionsApplied?: number;
}

interface TimeRangeQuery {
  start?: Date;
  end?: Date;
}

interface PeriodRequestBody {
  period: AnalyticsPeriod;
}

type ProjectParams = ParamsDictionary & { projectId: string };
type OptionalProjectParams = ParamsDictionary & { projectId?: string };
type OptionalUserParams = ParamsDictionary & { userId?: string };
type UserParams = ParamsDictionary & { userId: string };

interface SystemPerformanceFilter {
  metricType?: string;
  timestamp?: {
    gte?: Date;
    lte?: Date;
  };
}

// Validation schemas
const trackActivitySchema = Joi.object<TrackActivityRequestBody>({
  action: Joi.string()
    .valid(...ACTIVITY_TYPES)
    .required(),
  resource: Joi.string().required(),
  resourceId: Joi.string().required(),
  metadata: Joi.object().unknown(true).optional(),
  duration: Joi.number().optional(),
  sessionId: Joi.string().optional(),
});

const workflowProgressSchema = Joi.object<WorkflowProgressRequestBody>({
  projectId: Joi.string().required(),
  phase: Joi.string()
    .valid(...SPECIFICATION_PHASES)
    .required(),
  action: Joi.string().valid('started', 'completed', 'review_cycle', 'quality_updated').required(),
  qualityScore: Joi.number().min(0).max(100).optional(),
  collaboratorCount: Joi.number().min(0).optional(),
  commentCount: Joi.number().min(0).optional(),
  revisionCount: Joi.number().min(0).optional(),
  aiSuggestionsApplied: Joi.number().min(0).optional(),
});

const timeRangeSchema = Joi.object<TimeRangeQuery>({
  start: Joi.date().optional(),
  end: Joi.date().optional(),
});

const periodSchema = Joi.object<PeriodRequestBody>({
  period: Joi.string().valid('daily', 'weekly', 'monthly').default('weekly'),
});

type ValidationLocation = 'body' | 'query' | 'params';

const createValidationMiddleware = <TPayload>(
  schema: Joi.ObjectSchema<TPayload>,
  location: ValidationLocation = 'body'
): Middleware => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const target =
      location === 'body' ? req.body : location === 'query' ? req.query : req.params;

    const { error, value } = schema.validate(target, {
      abortEarly: false,
      allowUnknown: true,
      stripUnknown: true,
    });

    if (error) {
      const validationError: ApiError = {
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.') || location,
          message: detail.message,
        })),
      };

      res.status(400).json(validationError);
      return;
    }

    if (value && typeof value === 'object') {
      if (location === 'body') {
        req.body = value as typeof req.body;
      } else if (location === 'query') {
        req.query = value as typeof req.query;
      } else {
        req.params = value as typeof req.params;
      }
    }

    next();
  };
};

const firstQueryValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

const getStringQueryValue = (value: unknown): string | undefined => {
  const first = firstQueryValue(value);
  return typeof first === 'string' ? first : undefined;
};

const getNumberQueryValue = (value: unknown): number | undefined => {
  const first = firstQueryValue(value);
  if (typeof first === 'number') {
    return first;
  }
  if (typeof first === 'string') {
    const parsed = Number.parseInt(first, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const getDateQueryValue = (value: unknown): Date | undefined => {
  const first = firstQueryValue(value);
  if (first instanceof Date) {
    return first;
  }
  if (typeof first === 'string') {
    const parsed = new Date(first);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
};

// Middleware to check if user has analytics access
const requireAnalyticsAccess: Middleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Authentication required',
        code: 'MISSING_AUTH',
      };
      res.status(401).json(errorResponse);
      return;
    }

    // Team leads and admins can access analytics
    if (user.role === 'TEAM_LEAD' || user.role === 'ADMIN') {
      next();
      return;
    }

    // For project-specific analytics, check if user is project owner or team member
    const paramsProjectId = 'projectId' in req.params ? req.params.projectId : undefined;
    const queryProjectIdRaw = req.query.projectId;
    const queryProjectId = Array.isArray(queryProjectIdRaw)
      ? queryProjectIdRaw[0]
      : typeof queryProjectIdRaw === 'string'
        ? queryProjectIdRaw
        : undefined;
    const projectId = paramsProjectId || queryProjectId;

    if (projectId) {
      const project = await prisma.specificationProject.findFirst({
        where: {
          id: projectId,
          OR: [
            { ownerId: user.userId },
            { team: { some: { userId: user.userId, status: 'ACTIVE' } } },
          ],
        },
      });

      if (project) {
        next();
        return;
      }
    }

    const errorResponse: ApiError = {
      success: false,
      message: 'Insufficient permissions for analytics access',
      code: 'ACCESS_DENIED',
    };
    res.status(403).json(errorResponse);
  } catch (error) {
    console.error('Analytics access check error:', error);
    const errorResponse: ApiError = {
      success: false,
      message: 'Permission check failed',
      code: 'PERMISSION_ERROR',
    };
    res.status(500).json(errorResponse);
  }
};

// Track user activity
router.post(
  '/activity',
  authMiddleware,
  createValidationMiddleware<TrackActivityRequestBody>(trackActivitySchema),
  async (
    req: TypedRequest<EmptyParams, unknown, TrackActivityRequestBody>,
    res: Response
  ) => {
    try {
      const { action, resource, resourceId, metadata, duration, sessionId } = req.body;
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = user.id ?? user.userId;
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
router.post(
  '/workflow-progress',
  authMiddleware,
  createValidationMiddleware<WorkflowProgressRequestBody>(workflowProgressSchema),
  async (
    req: TypedRequest<EmptyParams, unknown, WorkflowProgressRequestBody>,
    res: Response
  ) => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = user.id ?? user.userId;
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
router.get(
  '/projects/:projectId',
  authMiddleware,
  requireAnalyticsAccess,
  createValidationMiddleware<TimeRangeQuery>(timeRangeSchema, 'query'),
  async (
    req: TypedRequest<ProjectParams, unknown, unknown, TimeRangeQuery>,
    res: Response
  ) => {
    try {
      const { projectId } = req.params;
      const { start, end } = req.query;

      const timeRange = start && end ? { start, end } : undefined;
      const analytics = await analyticsService.getProjectAnalytics(projectId, timeRange);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting project analytics:', error);
      res.status(500).json({ error: 'Failed to get project analytics' });
    }
  }
);

// Get team analytics
router.get(
  '/teams/:projectId',
  authMiddleware,
  requireAnalyticsAccess,
  createValidationMiddleware<TimeRangeQuery>(timeRangeSchema, 'query'),
  async (
    req: TypedRequest<ProjectParams, unknown, unknown, TimeRangeQuery>,
    res: Response
  ) => {
    try {
      const { projectId } = req.params;
      const { start, end } = req.query;

      const timeRange = start && end ? { start, end } : undefined;
      const analytics = await analyticsService.getTeamAnalytics(projectId, timeRange);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting team analytics:', error);
      res.status(500).json({ error: 'Failed to get team analytics' });
    }
  }
);

// Get user analytics
router.get(
  '/users/:userId?',
  authMiddleware,
  createValidationMiddleware<TimeRangeQuery>(timeRangeSchema, 'query'),
  async (
    req: TypedRequest<OptionalUserParams, unknown, unknown, TimeRangeQuery>,
    res: Response
  ) => {
    try {
      const requestedUserId = req.params.userId;
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const currentUserId = user.id ?? user.userId;
      const currentUserRole = user.role;

      // Users can only access their own analytics unless they're team leads or admins
      let userId = currentUserId;
      if (requestedUserId && requestedUserId !== currentUserId) {
        if (currentUserRole !== 'TEAM_LEAD' && currentUserRole !== 'ADMIN') {
          return res.status(403).json({ error: 'Cannot access other user analytics' });
        }
        userId = requestedUserId;
      }

      const { start, end } = req.query;
      const timeRange = start && end ? { start, end } : undefined;
      const analytics = await analyticsService.getUserAnalytics(userId, timeRange);

      res.json(analytics);
    } catch (error) {
      console.error('Error getting user analytics:', error);
      res.status(500).json({ error: 'Failed to get user analytics' });
    }
  }
);

// Calculate team performance metrics
router.post(
  '/teams/:projectId/performance',
  authMiddleware,
  requireAnalyticsAccess,
  createValidationMiddleware<PeriodRequestBody>(periodSchema),
  async (
    req: TypedRequest<ProjectParams, unknown, PeriodRequestBody>,
    res: Response
  ) => {
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
router.post(
  '/users/:userId/skills',
  authMiddleware,
  async (req: TypedRequest<UserParams>, res: Response) => {
    try {
      const requestedUserId = req.params.userId;
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const currentUserId = user.id ?? user.userId;
      const currentUserRole = user.role;

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
router.get(
  '/system/performance',
  authMiddleware,
  async (req: TypedRequest<EmptyParams>, res: Response) => {
    try {
      const user = req.user;

      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const metricType = getStringQueryValue(req.query.metricType);
      const start = getDateQueryValue(req.query.start);
      const end = getDateQueryValue(req.query.end);
      const limit = getNumberQueryValue(req.query.limit) ?? 100;

      const whereClause: SystemPerformanceFilter = {};
      if (metricType) {
        whereClause.metricType = metricType;
      }
      if (start || end) {
        whereClause.timestamp = {};
        if (start) {
          whereClause.timestamp.gte = start;
        }
        if (end) {
          whereClause.timestamp.lte = end;
        }
      }

      const metrics = await prisma.systemPerformanceMetrics.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      res.json(metrics);
    } catch (error) {
      console.error('Error getting system performance metrics:', error);
      res.status(500).json({ error: 'Failed to get system performance metrics' });
    }
  }
);

// Trigger metrics aggregation (admin only)
router.post(
  '/aggregate',
  authMiddleware,
  createValidationMiddleware<PeriodRequestBody>(periodSchema),
  async (
    req: TypedRequest<EmptyParams, unknown, PeriodRequestBody>,
    res: Response
  ) => {
    try {
      const user = req.user;

      if (!user || user.role !== 'ADMIN') {
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
router.get(
  '/dashboard/:projectId?',
  authMiddleware,
  requireAnalyticsAccess,
  async (
    req: TypedRequest<OptionalProjectParams>,
    res: Response
  ) => {
    try {
      const { projectId } = req.params;
      const user = req.user;

      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = user.id ?? user.userId;

      let dashboardData: unknown = {};

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
router.get(
  '/realtime',
  authMiddleware,
  async (req: TypedRequest<EmptyParams>, res: Response) => {
    try {
      const user = req.user;

      if (!user || (user.role !== 'TEAM_LEAD' && user.role !== 'ADMIN')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const keys = await redis.keys('analytics:realtime:*');
      const realTimeMetrics: Record<string, number> = {};

      for (const key of keys) {
        const value = await redis.get(key);
        const metricName = key.replace('analytics:realtime:', '');
        realTimeMetrics[metricName] = Number.parseInt(value || '0', 10);
      }

      res.json(realTimeMetrics);
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      res.status(500).json({ error: 'Failed to get real-time metrics' });
    }
  }
);

export default router;
