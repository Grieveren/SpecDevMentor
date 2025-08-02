import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { Redis } from 'redis';
import { AuthMiddleware, createAuthRateLimit } from '../middleware/auth.middleware.js';
import {
  AuthService,
  AuthenticationError,
  LoginRequest,
  RegisterRequest,
  TokenPair,
} from '../services/auth.service.js';
import {
  ApiError,
  ApiResponse,
  AuthenticatedRouteHandler,
  RouteHandler,
  ValidationError,
  ValidationErrorDetail,
} from '../types/express.js';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required',
    }),
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required',
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const resetPasswordRequestSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
    .required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Rate limiting
const authRateLimit = createAuthRateLimit();
const loginRateLimit = authRateLimit({ maxAttempts: 5, windowMs: 15 * 60 * 1000 }); // 5 attempts per 15 minutes
const registerRateLimit = authRateLimit({ maxAttempts: 3, windowMs: 60 * 60 * 1000 }); // 3 attempts per hour

export const createAuthRoutes = (redis: Redis) => {
  const authService = new AuthService(redis);
  const authMiddleware = new AuthMiddleware(authService);

  // Register endpoint
  const registerHandler: RouteHandler<{ user: any; tokens: TokenPair }> = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Validate request body
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        const details: ValidationErrorDetail[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        const validationError: ValidationError = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        };

        res.status(400).json(validationError);
        return;
      }

      const result = await authService.register(value as RegisterRequest);

      const response: ApiResponse<{ user: any; tokens: TokenPair }> = {
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Registration error:', error);

      if (error instanceof AuthenticationError) {
        const errorResponse: ApiError = {
          success: false,
          message: error.message,
          code: error.code,
        };
        res.status(400).json(errorResponse);
        return;
      }

      const errorResponse: ApiError = {
        success: false,
        message: 'Registration failed',
        code: 'REGISTRATION_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.post('/register', registerRateLimit, registerHandler);

  // Login endpoint
  const loginHandler: RouteHandler<{ user: any; tokens: TokenPair }> = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      // Validate request body
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        const details: ValidationErrorDetail[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        const validationError: ValidationError = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        };

        res.status(400).json(validationError);
        return;
      }

      const result = await authService.login(value as LoginRequest);

      const response: ApiResponse<{ user: any; tokens: TokenPair }> = {
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Login error:', error);

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
        message: 'Login failed',
        code: 'LOGIN_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.post('/login', loginRateLimit, loginHandler);

  // Refresh token endpoint
  const refreshHandler: RouteHandler<{ tokens: TokenPair }> = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        const details: ValidationErrorDetail[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        const validationError: ValidationError = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        };

        res.status(400).json(validationError);
        return;
      }

      const tokens = await authService.refreshTokens(value.refreshToken);

      const response: ApiResponse<{ tokens: TokenPair }> = {
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens },
      };

      res.json(response);
    } catch (error) {
      console.error('Token refresh error:', error);

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
        message: 'Token refresh failed',
        code: 'REFRESH_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.post('/refresh', refreshHandler);

  // Logout endpoint
  const logoutHandler: AuthenticatedRouteHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const refreshToken = req.body?.refreshToken;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Revoke current access token
      if (req.user?.jti) {
        await authService.revokeToken(req.user.jti);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Logout successful',
      };

      res.json(response);
    } catch (error) {
      console.error('Logout error:', error);

      // Always return success for logout
      const response: ApiResponse = {
        success: true,
        message: 'Logout successful',
      };
      res.json(response);
    }
  };

  router.post('/logout', authMiddleware.authenticate, logoutHandler);

  // Request password reset
  const forgotPasswordHandler: RouteHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { error, value } = resetPasswordRequestSchema.validate(req.body);
      if (error) {
        const errorResponse: ApiError = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        };
        res.status(400).json(errorResponse);
        return;
      }

      await authService.requestPasswordReset(value.email);

      // Always return success to prevent email enumeration
      const response: ApiResponse = {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
      };
      res.json(response);
    } catch (error) {
      console.error('Password reset request error:', error);

      // Always return success to prevent email enumeration
      const response: ApiResponse = {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
      };
      res.json(response);
    }
  };

  router.post(
    '/forgot-password',
    authRateLimit({ maxAttempts: 3, windowMs: 60 * 60 * 1000 }),
    forgotPasswordHandler
  );

  // Reset password
  const resetPasswordHandler: RouteHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        const details: ValidationErrorDetail[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        const validationError: ValidationError = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        };
        res.status(400).json(validationError);
        return;
      }

      await authService.resetPassword(value);

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successful',
      };
      res.json(response);
    } catch (error) {
      console.error('Password reset error:', error);

      if (error instanceof AuthenticationError) {
        const errorResponse: ApiError = {
          success: false,
          message: error.message,
          code: error.code,
        };
        res.status(400).json(errorResponse);
        return;
      }

      const errorResponse: ApiError = {
        success: false,
        message: 'Password reset failed',
        code: 'RESET_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.post('/reset-password', resetPasswordHandler);

  // Change password (authenticated)
  const changePasswordHandler: AuthenticatedRouteHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        const details: ValidationErrorDetail[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        const validationError: ValidationError = {
          success: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details,
        };
        res.status(400).json(validationError);
        return;
      }

      await authService.changePassword(
        authReq.user.userId,
        value.currentPassword,
        value.newPassword
      );

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
      };
      res.json(response);
    } catch (error) {
      console.error('Change password error:', error);

      if (error instanceof AuthenticationError) {
        const errorResponse: ApiError = {
          success: false,
          message: error.message,
          code: error.code,
        };
        res.status(400).json(errorResponse);
        return;
      }

      const errorResponse: ApiError = {
        success: false,
        message: 'Password change failed',
        code: 'CHANGE_PASSWORD_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.post('/change-password', authMiddleware.authenticate, changePasswordHandler);

  // Verify email
  const verifyEmailHandler: RouteHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.params.token;

      if (!token) {
        const errorResponse: ApiError = {
          success: false,
          message: 'Verification token is required',
          code: 'MISSING_TOKEN',
        };
        res.status(400).json(errorResponse);
        return;
      }

      await authService.verifyEmail(token);

      const response: ApiResponse = {
        success: true,
        message: 'Email verified successfully',
      };
      res.json(response);
    } catch (error) {
      console.error('Email verification error:', error);

      if (error instanceof AuthenticationError) {
        const errorResponse: ApiError = {
          success: false,
          message: error.message,
          code: error.code,
        };
        res.status(400).json(errorResponse);
        return;
      }

      const errorResponse: ApiError = {
        success: false,
        message: 'Email verification failed',
        code: 'VERIFICATION_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.get('/verify-email/:token', verifyEmailHandler);

  // Get current user profile
  const getUserProfileHandler: AuthenticatedRouteHandler = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await authService.getUserById(authReq.user.userId);

      if (!user) {
        const errorResponse: ApiError = {
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        };
        res.status(404).json(errorResponse);
        return;
      }

      const response: ApiResponse<{ user: any }> = {
        success: true,
        data: { user },
      };
      res.json(response);
    } catch (error) {
      console.error('Get user profile error:', error);

      const errorResponse: ApiError = {
        success: false,
        message: 'Failed to fetch user profile',
        code: 'PROFILE_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.get('/me', authMiddleware.authenticate, getUserProfileHandler);

  // Validate token endpoint (for client-side token validation)
  const validateTokenHandler: RouteHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.body.token || req.headers.authorization?.substring(7);

      if (!token) {
        const errorResponse: ApiError = {
          success: false,
          message: 'Token is required',
          code: 'MISSING_TOKEN',
        };
        res.status(400).json(errorResponse);
        return;
      }

      const payload = await authService.verifyToken(token);

      const response: ApiResponse<{
        valid: boolean;
        payload: {
          userId: string;
          email: string;
          role: string;
          exp: number;
        };
      }> = {
        success: true,
        data: {
          valid: true,
          payload: {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            exp: payload.exp,
          },
        },
      };
      res.json(response);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        const response: ApiResponse<{
          valid: boolean;
          error: string;
          code: string;
        }> = {
          success: true,
          data: {
            valid: false,
            error: error.message,
            code: error.code,
          },
        };
        res.json(response);
        return;
      }

      const errorResponse: ApiError = {
        success: false,
        message: 'Token validation failed',
        code: 'VALIDATION_ERROR',
      };
      res.status(500).json(errorResponse);
    }
  };

  router.post('/validate', validateTokenHandler);

  return router;
};

export default router;
