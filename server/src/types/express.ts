import { UserRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';

// JWT Payload interface
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

// Extended Request interface for authenticated routes
export interface AuthenticatedRequest extends Request {
  user: JWTPayload & { id: string };
}

// Standard API response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// API error response
export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: any;
}

// Validation error details
export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
}

// Validation error response
export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: ValidationErrorDetail[];
}

// Route handler types
export type RouteHandler<T = any> = (
  req: Request,
  res: Response,
  next?: NextFunction
) => Promise<void> | void;

export type AuthenticatedRouteHandler<T = any> = (
  req: AuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => Promise<void> | void;

// Middleware types
export type Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export type ErrorMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => void;

// Rate limiting configuration
export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

// Extend Express Request interface globally
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { id: string };
    }
  }
}
