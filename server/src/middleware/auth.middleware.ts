import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthenticationError, JWTPayload } from '../services/auth.service.js';
import { UserRole } from '@prisma/client';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

export class AuthMiddleware {
  constructor(private authService: AuthService) {}

  // Middleware to authenticate JWT tokens
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'MISSING_TOKEN',
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        const payload = await this.authService.verifyToken(token);
        req.user = payload;
        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          res.status(401).json({
            error: error.message,
            code: error.code,
          });
          return;
        }
        throw error;
      }
    } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({
        error: 'Authentication check failed',
        code: 'AUTH_ERROR',
      });
    }
  };

  // Optional authentication - doesn't fail if no token provided
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const payload = await this.authService.verifyToken(token);
          req.user = payload;
        } catch (error) {
          // Ignore authentication errors for optional auth
          console.warn('Optional authentication failed:', error);
        }
      }

      next();
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      next(); // Continue without authentication
    }
  };

  // Middleware to require specific roles
  requireRole = (roles: UserRole | UserRole[]) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'MISSING_AUTH',
        });
        return;
      }

      if (!requiredRoles.includes(req.user.role)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: requiredRoles,
          current: req.user.role,
        });
        return;
      }

      next();
    };
  };

  // Middleware to require admin role
  requireAdmin = this.requireRole(UserRole.ADMIN);

  // Middleware to require team lead or admin role
  requireTeamLead = this.requireRole([UserRole.TEAM_LEAD, UserRole.ADMIN]);

  // Middleware to check if user owns resource or has admin privileges
  requireOwnershipOrAdmin = (getResourceUserId: (req: Request) => string | Promise<string>) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          res.status(401).json({
            error: 'Authentication required',
            code: 'MISSING_AUTH',
          });
          return;
        }

        // Admin can access everything
        if (req.user.role === UserRole.ADMIN) {
          next();
          return;
        }

        // Check ownership
        const resourceUserId = await getResourceUserId(req);
        if (req.user.userId === resourceUserId) {
          next();
          return;
        }

        res.status(403).json({
          error: 'Access denied - insufficient permissions',
          code: 'ACCESS_DENIED',
        });
      } catch (error) {
        console.error('Ownership check error:', error);
        res.status(500).json({
          error: 'Permission check failed',
          code: 'PERMISSION_ERROR',
        });
      }
    };
  };

  // Middleware to validate email verification
  requireVerifiedEmail = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'MISSING_AUTH',
      });
      return;
    }

    // For now, we'll skip email verification requirement
    // In production, you might want to check user.isVerified
    next();
  };
}

// Rate limiting for authentication endpoints
export const createAuthRateLimit = () => {
  // This would typically use express-rate-limit or similar
  // For now, we'll create a simple in-memory rate limiter
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (maxAttempts: number, windowMs: number) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = req.ip + ':' + (req.body.email || 'unknown');
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [k, v] of attempts.entries()) {
        if (v.resetTime < windowStart) {
          attempts.delete(k);
        }
      }

      const current = attempts.get(key);
      if (!current) {
        attempts.set(key, { count: 1, resetTime: now + windowMs });
        next();
        return;
      }

      if (current.count >= maxAttempts) {
        res.status(429).json({
          error: 'Too many attempts, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((current.resetTime - now) / 1000),
        });
        return;
      }

      current.count++;
      next();
    };
  };
};

export default AuthMiddleware;