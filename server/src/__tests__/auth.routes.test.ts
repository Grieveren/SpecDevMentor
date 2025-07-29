import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createAuthRoutes } from '../routes/auth.routes.js';
import { AuthService, AuthenticationError } from '../services/auth.service.js';

// Mock the AuthService
vi.mock('../services/auth.service.js');

// Mock the rate limiting middleware to avoid interference
vi.mock('../middleware/auth.middleware.js', async () => {
  const actual = await vi.importActual('../middleware/auth.middleware.js');
  return {
    ...actual,
    createAuthRateLimit: () => () => (_req: unknown, _res: unknown, _next: unknown) => next(),
  };
});

const mockRedis = {
  sMembers: vi.fn(),
  sAdd: vi.fn(),
  expire: vi.fn(),
} as any;

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
  refreshTokens: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  verifyEmail: vi.fn(),
  getUserById: vi.fn(),
  verifyToken: vi.fn(),
  revokeToken: vi.fn(),
} as any;

// Mock the AuthService constructor
vi.mocked(AuthService).mockImplementation(() => mockAuthService);

describe('Auth Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', createAuthRoutes(mockRedis));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    const validRegisterData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      const mockResponse = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'DEVELOPER',
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const _response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'User registered successfully',
        data: mockResponse,
      });

      expect(mockAuthService.register).toHaveBeenCalledWith(validRegisterData);
    });

    it('should return validation error for invalid email', async () => {
      const invalidData = {
        ...validRegisterData,
        email: 'invalid-email',
      };

      const _response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: 'Please provide a valid email address',
          }),
        ])
      );
    });

    it('should return validation error for weak password', async () => {
      const invalidData = {
        ...validRegisterData,
        password: 'weak',
      };

      const _response = await request(app)
        .post('/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
          }),
        ])
      );
    });

    it('should return error when user already exists', async () => {
      mockAuthService.register.mockRejectedValue(
        new AuthenticationError('User already exists with this email', 'USER_EXISTS')
      );

      const _response = await request(app)
        .post('/auth/register')
        .send(validRegisterData)
        .expect(400);

      expect(response.body).toEqual({
        error: 'User already exists with this email',
        code: 'USER_EXISTS',
      });
    });
  });

  describe('POST /auth/login', () => {
    const validLoginData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'DEVELOPER',
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const _response = await request(app)
        .post('/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        data: mockResponse,
      });

      expect(mockAuthService.login).toHaveBeenCalledWith(validLoginData);
    });

    it('should return error for invalid credentials', async () => {
      mockAuthService.login.mockRejectedValue(
        new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS')
      );

      const _response = await request(app)
        .post('/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('should return validation error for missing fields', async () => {
      const _response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should successfully refresh tokens', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      mockAuthService.refreshTokens.mockResolvedValue(mockTokens);

      const _response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Tokens refreshed successfully',
        data: { tokens: mockTokens },
      });

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should return error for invalid refresh token', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(
        new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN')
      );

      const _response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('should successfully logout', async () => {
      // Mock authentication middleware
      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'DEVELOPER',
        jti: 'token-id',
      });

      mockAuthService.logout.mockResolvedValue(undefined);
      mockAuthService.revokeToken.mockResolvedValue(undefined);

      const _response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .send({ refreshToken: 'refresh-token' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should return error for missing authentication', async () => {
      const _response = await request(app)
        .post('/auth/logout')
        .send({ refreshToken: 'refresh-token' })
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should successfully request password reset', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue(undefined);

      const _response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent',
      });

      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
    });

    it('should return success even for non-existent email', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue(undefined);

      const _response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('should successfully reset password', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const _response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          newPassword: 'NewPassword123!',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password reset successful',
      });

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      });
    });

    it('should return error for invalid reset token', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new AuthenticationError('Invalid or expired reset token', 'INVALID_RESET_TOKEN')
      );

      const _response = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
        })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'DEVELOPER',
      };

      mockAuthService.verifyToken.mockResolvedValue({
        userId: 'user-1',
        email: 'test@example.com',
        role: 'DEVELOPER',
        jti: 'token-id',
      });

      mockAuthService.getUserById.mockResolvedValue(mockUser);

      const _response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { user: mockUser },
      });

      expect(mockAuthService.getUserById).toHaveBeenCalledWith('user-1');
    });

    it('should return error for missing authentication', async () => {
      const _response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });
  });

  describe('POST /auth/validate', () => {
    it('should validate valid token', async () => {
      const mockPayload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'DEVELOPER',
        exp: Date.now() + 900000,
        jti: 'token-id',
      };

      mockAuthService.verifyToken.mockResolvedValue(mockPayload);

      const _response = await request(app)
        .post('/auth/validate')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          valid: true,
          payload: {
            userId: 'user-1',
            email: 'test@example.com',
            role: 'DEVELOPER',
            exp: mockPayload.exp,
          },
        },
      });
    });

    it('should return invalid for invalid token', async () => {
      mockAuthService.verifyToken.mockRejectedValue(
        new AuthenticationError('Invalid token', 'INVALID_TOKEN')
      );

      const _response = await request(app)
        .post('/auth/validate')
        .send({ token: 'invalid-token' })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          valid: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
        },
      });
    });
  });
});