import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthService, AuthenticationError } from '../services/auth.service.js';
import { AuthMiddleware, createAuthRateLimit } from '../middleware/auth.middleware.js';
import { Redis } from 'redis';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
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
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required(),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]')).required(),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// Rate limiting
const authRateLimit = createAuthRateLimit();
const loginRateLimit = authRateLimit(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
const registerRateLimit = authRateLimit(3, 60 * 60 * 1000); // 3 attempts per hour

export const createAuthRoutes = (redis: Redis) => {
  const authService = new AuthService(redis);
  const authMiddleware = new AuthMiddleware(authService);

  // Register endpoint
  router.post('/register', registerRateLimit, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
        return;
      }

      const result = await authService.register(value);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      console.error('Registration error:', error);

      if (error instanceof AuthenticationError) {
        res.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
      });
    }
  });

  // Login endpoint
  router.post('/login', loginRateLimit, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
        return;
      }

      const result = await authService.login(value);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          tokens: result.tokens,
        },
      });
    } catch (error) {
      console.error('Login error:', error);

      if (error instanceof AuthenticationError) {
        res.status(401).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR',
      });
    }
  });

  // Refresh token endpoint
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
        return;
      }

      const tokens = await authService.refreshTokens(value.refreshToken);

      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens },
      });
    } catch (error) {
      console.error('Token refresh error:', error);

      if (error instanceof AuthenticationError) {
        res.status(401).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR',
      });
    }
  });

  // Logout endpoint
  router.post('/logout', authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const refreshToken = req.body.refreshToken;
      
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Revoke current access token
      if (req.user?.jti) {
        await authService.revokeToken(req.user.jti);
      }

      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error:', error);
      
      // Always return success for logout
      res.json({
        success: true,
        message: 'Logout successful',
      });
    }
  });

  // Request password reset
  router.post('/forgot-password', authRateLimit(3, 60 * 60 * 1000), async (req: Request, res: Response) => {
    try {
      const { error, value } = resetPasswordRequestSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
        return;
      }

      await authService.requestPasswordReset(value.email);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      
      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
      });
    }
  });

  // Reset password
  router.post('/reset-password', async (req: Request, res: Response) => {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
        return;
      }

      await authService.resetPassword(value);

      res.json({
        success: true,
        message: 'Password reset successful',
      });
    } catch (error) {
      console.error('Password reset error:', error);

      if (error instanceof AuthenticationError) {
        res.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Password reset failed',
        code: 'RESET_ERROR',
      });
    }
  });

  // Change password (authenticated)
  router.post('/change-password', authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        });
        return;
      }

      await authService.changePassword(req.user!.userId, value.currentPassword, value.newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      console.error('Change password error:', error);

      if (error instanceof AuthenticationError) {
        res.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Password change failed',
        code: 'CHANGE_PASSWORD_ERROR',
      });
    }
  });

  // Verify email
  router.get('/verify-email/:token', async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      
      if (!token) {
        res.status(400).json({
          error: 'Verification token is required',
          code: 'MISSING_TOKEN',
        });
        return;
      }

      await authService.verifyEmail(token);

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      console.error('Email verification error:', error);

      if (error instanceof AuthenticationError) {
        res.status(400).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      res.status(500).json({
        error: 'Email verification failed',
        code: 'VERIFICATION_ERROR',
      });
    }
  });

  // Get current user profile
  router.get('/me', authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const user = await authService.getUserById(req.user!.userId);
      
      if (!user) {
        res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error('Get user profile error:', error);
      
      res.status(500).json({
        error: 'Failed to fetch user profile',
        code: 'PROFILE_ERROR',
      });
    }
  });

  // Validate token endpoint (for client-side token validation)
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      const token = req.body.token || req.headers.authorization?.substring(7);
      
      if (!token) {
        res.status(400).json({
          error: 'Token is required',
          code: 'MISSING_TOKEN',
        });
        return;
      }

      const payload = await authService.verifyToken(token);

      res.json({
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
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        res.json({
          success: true,
          data: {
            valid: false,
            error: error.message,
            code: error.code,
          },
        });
        return;
      }

      res.status(500).json({
        error: 'Token validation failed',
        code: 'VALIDATION_ERROR',
      });
    }
  });

  return router;
};

export default router;