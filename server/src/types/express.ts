import { NextFunction, Request, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

export type UserRole = 'STUDENT' | 'DEVELOPER' | 'TEAM_LEAD' | 'ADMIN';

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
export type TypedRequest<
  Params extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = Request<Params, ResBody, ReqBody, ReqQuery, Locals>;

export type TypedResponse<
  ResBody = any,
  Locals extends Record<string, any> = Record<string, any>
> = Response<ResBody, Locals>;

export interface AuthenticatedRequest<
  Params extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<Params, ResBody, ReqBody, ReqQuery, Locals> {
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
  // Some routes also include a shorthand 'error' field for compatibility with tests/clients
  error?: string;
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

export type TypedRouteHandler<
  ResBody = any,
  ReqBody = any,
  Params extends ParamsDictionary = ParamsDictionary,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  req: TypedRequest<Params, ResBody, ReqBody, ReqQuery, Locals>,
  res: TypedResponse<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

export type TypedAuthenticatedRouteHandler<
  ResBody = any,
  ReqBody = any,
  Params extends ParamsDictionary = ParamsDictionary,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  req: AuthenticatedRequest<Params, ResBody, ReqBody, ReqQuery, Locals>,
  res: TypedResponse<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

// Middleware types
export type Middleware = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

export type TypedMiddleware<
  Params extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  req: TypedRequest<Params, ResBody, ReqBody, ReqQuery, Locals>,
  res: TypedResponse<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

export type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

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
