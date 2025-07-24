import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { 
  ProjectService, 
  CreateProjectRequest, 
  UpdateProjectRequest, 
  AddTeamMemberRequest,
  ProjectError 
} from '../services/project.service.js';
import { AuthService, AuthenticationError } from '../services/auth.service.js';

const router = Router();

// Simple auth middleware for project routes
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    userId: string;
    email: string;
    role: string;
    jti: string;
  };
}

// Initialize services
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const projectService = new ProjectService(prisma, redis);
const authService = new AuthService(redis);

// Validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Auth middleware
const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'MISSING_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);
    (req as AuthenticatedRequest).user = { ...payload, id: payload.userId };
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Authentication check failed',
      code: 'AUTH_ERROR',
    });
  }
};

// Error handling middleware for project operations
const handleProjectError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof ProjectError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }

  console.error('Project operation error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
};

// GET /api/projects - Get projects for authenticated user
router.get(
  '/',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim().isLength({ max: 100 }),
    query('status').optional().isIn(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'SUSPENDED']),
    query('phase').optional().isIn(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
    query('ownerId').optional().isString(),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        status,
        phase,
        ownerId,
      } = req.query;

      const result = await projectService.getProjectsForUser(
        req.user.id,
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

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/projects - Create new project
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
    body('teamMemberIds')
      .optional()
      .isArray()
      .withMessage('Team member IDs must be an array'),
    body('teamMemberIds.*')
      .optional()
      .isString()
      .withMessage('Each team member ID must be a string'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const projectData: CreateProjectRequest = {
        name: req.body.name,
        description: req.body.description,
        teamMemberIds: req.body.teamMemberIds,
      };

      const project = await projectService.createProject(projectData, req.user.id);

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/projects/:id - Get specific project
router.get(
  '/:id',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.getProjectById(req.params.id, req.user.id);

      res.json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/projects/:id - Update project
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const updateData: UpdateProjectRequest = {
        name: req.body.name,
        description: req.body.description,
        currentPhase: req.body.currentPhase,
        status: req.body.status,
      };

      const project = await projectService.updateProject(req.params.id, updateData, req.user.id);

      res.json({
        success: true,
        data: project,
        message: 'Project updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/projects/:id - Delete project
router.delete(
  '/:id',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await projectService.deleteProject(req.params.id, req.user.id);

      res.json({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/projects/:id/team - Add team member
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
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const teamMemberData: AddTeamMemberRequest = {
        userId: req.body.userId,
        role: req.body.role,
      };

      await projectService.addTeamMember(req.params.id, teamMemberData, req.user.id);

      res.json({
        success: true,
        message: 'Team member added successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/projects/:id/team/:memberId - Remove team member
router.delete(
  '/:id/team/:memberId',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
    param('memberId').isString().withMessage('Member ID is required'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await projectService.removeTeamMember(req.params.id, req.params.memberId, req.user.id);

      res.json({
        success: true,
        message: 'Team member removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/projects/:id/analytics - Get project analytics
router.get(
  '/:id/analytics',
  authMiddleware,
  [
    param('id').isString().withMessage('Project ID is required'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const analytics = await projectService.getProjectAnalytics(req.params.id, req.user.id);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handling middleware
router.use(handleProjectError);

export default router;