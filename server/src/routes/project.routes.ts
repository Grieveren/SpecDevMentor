// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { NextFunction, Request, Response, Router } from 'express';
import type { Router as ExpressRouter } from 'express';import { body, param, query, validationResult } from 'express-validator';
import Redis from 'ioredis';
import { AuthService } from '../services/auth.service.js';
import { AuthenticationError } from '../../../shared/types';
import {
  AddTeamMemberRequest,
  CreateProjectRequest,
  ProjectService,
  UpdateProjectRequest,
} from '../services/project.service.js';
import {
  ApiError,
  ApiResponse,
  AuthenticatedRequest,
  AuthenticatedRouteHandler,
  ErrorMiddleware,
  Middleware,
} from '../types/express.js';

const router: ExpressRouter = Router();

// Initialize services
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const projectService = new ProjectService(prisma, redis);
// Ensure secrets in test to avoid constructor error
if (process.env.NODE_ENV === 'test') {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.REFRESH_SECRET = process.env.REFRESH_SECRET || 'test-refresh-secret';
}
const authService = new AuthService(redis);

// Validation middleware
const validateRequest: Middleware = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorResponse: ApiError = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array(),
    };
    res.status(400).json(errorResponse);
    return;
  }
  next();
};

// Auth middleware
const authMiddleware: Middleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const errorResponse: ApiError = {
        success: false,
        message: 'Authentication required',
        code: 'MISSING_TOKEN',
      };
      res.status(401).json(errorResponse);
      return;
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);
    (req as AuthenticatedRequest).user = { ...payload, id: payload.userId };
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      const errorResponse: ApiError = {
        success: false,
        message: error.message,
        code: error.code,
      };
      res.status(401).json(errorResponse);
      return;
    }

    const errorResponse: ApiError = {
      success: false,
      message: 'Authentication check failed',
      code: 'AUTH_ERROR',
    };
    res.status(500).json(errorResponse);
  }
};

// Error handling middleware for project operations
const handleProjectError: ErrorMiddleware = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle known error types from shared/types
  if (error instanceof Error && 'code' in error && 'statusCode' in error) {
    const errorResponse: ApiError = {
      success: false,
      message: error.message,
      code: (error as any).code,
    };
    res.status((error as any).statusCode).json(errorResponse);
    return;
  }

  console.error('Project operation error:', error);
  const errorResponse: ApiError = {
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  };
  res.status(500).json(errorResponse);
};

// GET /api/projects - Get projects for authenticated user
const getProjectsHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { page = '1', limit = '10', search, status, phase, ownerId } = req.query;

    const result = await projectService.getProjectsForUser(
      authReq.user.id,
      {
        search: search as string,
        status: status as any,
        phase: phase as any,
        ownerId: ownerId as string,
      },
      {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      }
    );

    const response: ApiResponse = {
      success: true,
      data: result,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim().isLength({ max: 100 }),
    query('status').optional().isIn(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'SUSPENDED']),
    query('phase').optional().isIn(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
    query('ownerId').optional().isString(),
  ],
  validateRequest,
  getProjectsHandler
);

// POST /api/projects - Create new project
const createProjectHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const projectData: CreateProjectRequest = {
      name: req.body.name,
      description: req.body.description,
      teamMemberIds: req.body.teamMemberIds,
    };

    const project = await projectService.createProject(projectData, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      data: project,
      message: 'Project created successfully',
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

router.post(
  '/',
  authMiddleware,
  [
    body('name')
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name is required and must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('teamMemberIds').optional().isArray().withMessage('Team member IDs must be an array'),
    body('teamMemberIds.*')
      .optional()
      .isString()
      .withMessage('Each team member ID must be a string'),
  ],
  validateRequest,
  createProjectHandler
);

// GET /api/projects/:id - Get specific project
const getProjectByIdHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const project = await projectService.getProjectById(req.params.id, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      data: project,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.get(
  '/:id',
  authMiddleware,
  [param('id').isString().withMessage('Project ID is required')],
  validateRequest,
  getProjectByIdHandler
);

// PUT /api/projects/:id - Update project
const updateProjectHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const updateData: UpdateProjectRequest = {
      name: req.body.name,
      description: req.body.description,
      currentPhase: req.body.currentPhase,
      status: req.body.status,
    };

    const project = await projectService.updateProject(req.params.id, updateData, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      data: project,
      message: 'Project updated successfully',
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.put(
  '/:id',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('currentPhase')
      .optional()
      .isIn(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION'])
      .withMessage('Invalid phase'),
    body('status')
      .optional()
      .isIn(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'SUSPENDED'])
      .withMessage('Invalid status'),
  ],
  validateRequest,
  updateProjectHandler
);

// DELETE /api/projects/:id - Delete project
const deleteProjectHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    await projectService.deleteProject(req.params.id, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      message: 'Project deleted successfully',
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.delete(
  '/:id',
  authMiddleware,
  [param('id').isString().withMessage('Project ID is required')],
  validateRequest,
  deleteProjectHandler
);

// POST /api/projects/:id/team - Add team member
const addTeamMemberHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const teamMemberData: AddTeamMemberRequest = {
      userId: req.body.userId,
      role: req.body.role,
    };

    await projectService.addTeamMember(req.params.id, teamMemberData, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      message: 'Team member added successfully',
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.post(
  '/:id/team',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
    body('userId').isString().withMessage('User ID is required'),
    body('role')
      .isIn(['MEMBER', 'LEAD', 'ADMIN'])
      .withMessage('Role must be MEMBER, LEAD, or ADMIN'),
  ],
  validateRequest,
  addTeamMemberHandler
);

// DELETE /api/projects/:id/team/:memberId - Remove team member
const removeTeamMemberHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    await projectService.removeTeamMember(req.params.id, req.params.memberId, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      message: 'Team member removed successfully',
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.delete(
  '/:id/team/:memberId',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
    param('memberId').isString().withMessage('Member ID is required'),
  ],
  validateRequest,
  removeTeamMemberHandler
);

// GET /api/projects/:id/analytics - Get project analytics
const getProjectAnalyticsHandler: AuthenticatedRouteHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const analytics = await projectService.getProjectAnalytics(req.params.id, authReq.user.id);

    const response: ApiResponse = {
      success: true,
      data: analytics,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
};

router.get(
  '/:id/analytics',
  authMiddleware,
  [param('id').isString().withMessage('Project ID is required')],
  validateRequest,
  getProjectAnalyticsHandler
);

// Apply error handling middleware
router.use(handleProjectError);

export default router;
