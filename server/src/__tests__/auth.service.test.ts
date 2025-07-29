import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('bcryptjs');
vi.mock('jsonwebtoken');

// Mock Prisma Client completely
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
  UserRole: {
    STUDENT: 'STUDENT',
    DEVELOPER: 'DEVELOPER',
    TEAM_LEAD: 'TEAM_LEAD',
    ADMIN: 'ADMIN',
  },
}));

// Import after mocking
const { AuthService, AuthenticationError } = await import('../services/auth.service.js');

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
} as any;

const mockRedis = {
  sMembers: vi.fn(),
  sAdd: vi.fn(),
  expire: vi.fn(),
} as any;

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';

describe('AuthService', () => {
  let authService: AuthService;

  beforeAll(() => {
    const { PrismaClient } = await import('@prisma/client');
    vi.mocked(PrismaClient).mockImplementation(() => mockPrisma);
  });

  beforeEach(() => {
    authService = new AuthService(mockRedis);
    vi.clearAllMocks();
    
    // Setup default mocks
    mockRedis.sMembers.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      // Mock user doesn't exist
      mockPrisma.user.findUnique.mockResolvedValue(null);
      
      // Mock password hashing
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password');
      
      // Mock user creation
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'DEVELOPER',
        isVerified: false,
        verificationToken: 'verification-token',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.user.create.mockResolvedValue(mockUser);
      
      // Mock token generation
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const _result = await authService.register(registerData);

      expect(result.user).toEqual(expect.objectContaining({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      }));
      expect(result.user).not.toHaveProperty('password');
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('TestPassword123!', 12);
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(authService.register(registerData)).rejects.toThrow(
        new AuthenticationError('User already exists with this email', 'USER_EXISTS')
      );
    });
  });

  describe('login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        role: 'DEVELOPER',
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const _result = await authService.login(loginData);

      expect(result.user).toEqual(expect.objectContaining({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      }));
      expect(result.user).not.toHaveProperty('password');
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw error for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.login(loginData)).rejects.toThrow(
        new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS')
      );
    });

    it('should throw error for invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
      };
      
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(authService.login(loginData)).rejects.toThrow(
        new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS')
      );
    });
  });

  describe('verifyToken', () => {
    it('should successfully verify valid token', async () => {
      const mockPayload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'DEVELOPER',
        jti: 'token-id',
        iat: Date.now(),
        exp: Date.now() + 900000,
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload);

      const _result = await authService.verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret', {
        issuer: 'codementor-ai',
        audience: 'codementor-ai-client',
      });
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      await expect(authService.verifyToken('invalid-token')).rejects.toThrow(
        new AuthenticationError('Invalid token', 'INVALID_TOKEN')
      );
    });

    it('should throw error for revoked token', async () => {
      const mockPayload = {
        userId: 'user-1',
        email: 'test@example.com',
        role: 'DEVELOPER',
        jti: 'revoked-token-id',
        iat: Date.now(),
        exp: Date.now() + 900000,
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload);
      
      // Mock revoked token
      authService['revokedTokens'].add('revoked-token-id');

      await expect(authService.verifyToken('revoked-token')).rejects.toThrow(
        new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED')
      );
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      const mockPayload = { userId: 'user-1', jti: 'token-id' };
      const mockStoredToken = {
        id: 'refresh-1',
        token: 'refresh-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        isRevoked: false,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'DEVELOPER',
        },
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload);
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      vi.mocked(jwt.sign)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const _result = await authService.refreshTokens('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'refresh-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw error for invalid refresh token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      await expect(authService.refreshTokens('invalid-refresh-token')).rejects.toThrow(
        new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN')
      );
    });

    it('should throw error for revoked refresh token', async () => {
      const mockPayload = { userId: 'user-1', jti: 'token-id' };
      const mockStoredToken = {
        id: 'refresh-1',
        token: 'refresh-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 86400000),
        isRevoked: true, // Token is revoked
        user: { id: 'user-1' },
      };

      vi.mocked(jwt.verify).mockReturnValue(mockPayload);
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);

      await expect(authService.refreshTokens('refresh-token')).rejects.toThrow(
        new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN')
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue({});

      await authService.requestPasswordReset('test@example.com');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          resetToken: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        },
      });
    });

    it('should not throw error for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      const mockUser = {
        id: 'user-1',
        resetToken: 'valid-reset-token',
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password');
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      await authService.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: 'new-hashed-password',
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw error for invalid reset token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.resetPassword({
        token: 'invalid-token',
        newPassword: 'NewPassword123!',
      })).rejects.toThrow(
        new AuthenticationError('Invalid or expired reset token', 'INVALID_RESET_TOKEN')
      );
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'old-hashed-password',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true);
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password');
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});

      await authService.changePassword('user-1', 'oldPassword', 'NewPassword123!');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'new-hashed-password' },
      });

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw error for incorrect current password', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'old-hashed-password',
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false);

      await expect(authService.changePassword('user-1', 'wrongPassword', 'NewPassword123!')).rejects.toThrow(
        new AuthenticationError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD')
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired and revoked tokens', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 2 });

      await authService.cleanupExpiredTokens();

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { isRevoked: true },
          ],
        },
      });

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          resetTokenExpiry: { lt: expect.any(Date) },
        },
        data: {
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    });
  });
});