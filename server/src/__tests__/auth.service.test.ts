import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import type { MockedFunction } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock dependencies with proper typing
const mockBcryptHash = vi.fn() as MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = vi.fn() as MockedFunction<typeof bcrypt.compare>;
const mockJwtSign = vi.fn() as MockedFunction<typeof jwt.sign>;
const mockJwtVerify = vi.fn() as MockedFunction<typeof jwt.verify>;

vi.mock('bcryptjs', () => ({
  default: {
    hash: mockBcryptHash,
    compare: mockBcryptCompare,
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: mockJwtSign,
    verify: mockJwtVerify,
    JsonWebTokenError: class JsonWebTokenError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'JsonWebTokenError';
      }
    },
  },
}));

// Mock Prisma Client with proper typing
const mockPrismaUser = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
};

const mockPrismaRefreshToken = {
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
};

const mockPrisma = {
  user: mockPrismaUser,
  refreshToken: mockPrismaRefreshToken,
} as any;

const mockRedis = {
  sMembers: vi.fn(),
  sAdd: vi.fn(),
  expire: vi.fn(),
} as any;

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  UserRole: {
    STUDENT: 'STUDENT',
    DEVELOPER: 'DEVELOPER',
    TEAM_LEAD: 'TEAM_LEAD',
    ADMIN: 'ADMIN',
  },
}));

// Import after mocking
const { AuthService, AuthenticationError } = await import('../services/auth.service.js');

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_SECRET = 'test-refresh-secret';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockRedis);
    vi.clearAllMocks();
    
    // Clear all mock functions
    mockBcryptHash.mockClear();
    mockBcryptCompare.mockClear();
    mockJwtSign.mockClear();
    mockJwtVerify.mockClear();
    mockPrismaUser.findUnique.mockClear();
    mockPrismaUser.findFirst.mockClear();
    mockPrismaUser.create.mockClear();
    mockPrismaUser.update.mockClear();
    mockPrismaUser.updateMany.mockClear();
    mockPrismaRefreshToken.findUnique.mockClear();
    mockPrismaRefreshToken.create.mockClear();
    mockPrismaRefreshToken.update.mockClear();
    mockPrismaRefreshToken.updateMany.mockClear();
    mockPrismaRefreshToken.deleteMany.mockClear();
    
    // Setup default mocks
    mockRedis.sMembers.mockResolvedValue([]);
  });

  describe('register', () => {
    const registerData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
    };

    it('should successfully register a new user', async () => {
      // Mock user doesn't exist
      mockPrismaUser.findUnique.mockResolvedValue(null);
      
      // Mock password hashing
      mockBcryptHash.mockResolvedValue('hashed-password');
      
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
      mockPrismaUser.create.mockResolvedValue(mockUser);
      
      // Mock token generation
      mockJwtSign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      
      mockPrismaRefreshToken.create.mockResolvedValue({});

      const result = await authService.register(registerData);

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

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(mockBcryptHash).toHaveBeenCalledWith('TestPassword123!', 12);
      expect(mockPrismaUser.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({ id: 'existing-user' });

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
      
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockJwtSign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockPrismaRefreshToken.create.mockResolvedValue({});

      const result = await authService.login(loginData);

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
      mockPrismaUser.findUnique.mockResolvedValue(null);

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
      
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

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

      mockJwtVerify.mockReturnValue(mockPayload);

      const result = await authService.verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret', {
        issuer: 'codementor-ai',
        audience: 'codementor-ai-client',
      });
    });

    it('should throw error for invalid token', async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error('invalid token');
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

      mockJwtVerify.mockReturnValue(mockPayload);
      
      // Mock revoked token
      (authService as any).revokedTokens.add('revoked-token-id');

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

      mockJwtVerify.mockReturnValue(mockPayload);
      mockPrismaRefreshToken.findUnique.mockResolvedValue(mockStoredToken);
      mockPrismaRefreshToken.update.mockResolvedValue({});
      mockJwtSign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockPrismaRefreshToken.create.mockResolvedValue({});

      const result = await authService.refreshTokens('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      expect(mockPrismaRefreshToken.update).toHaveBeenCalledWith({
        where: { id: 'refresh-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw error for invalid refresh token', async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error('invalid token');
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

      mockJwtVerify.mockReturnValue(mockPayload);
      mockPrismaRefreshToken.findUnique.mockResolvedValue(mockStoredToken);

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

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockPrismaUser.update.mockResolvedValue({});

      await authService.requestPasswordReset('test@example.com');

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          resetToken: expect.any(String),
          resetTokenExpiry: expect.any(Date),
        },
      });
    });

    it('should not throw error for non-existent user', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

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

      mockPrismaUser.findFirst.mockResolvedValue(mockUser);
      mockBcryptHash.mockResolvedValue('new-hashed-password');
      mockPrismaUser.update.mockResolvedValue({});
      mockPrismaRefreshToken.updateMany.mockResolvedValue({});

      await authService.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NewPassword123!',
      });

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          password: 'new-hashed-password',
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw error for invalid reset token', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

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

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);
      mockBcryptHash.mockResolvedValue('new-hashed-password');
      mockPrismaUser.update.mockResolvedValue({});
      mockPrismaRefreshToken.updateMany.mockResolvedValue({});

      await authService.changePassword('user-1', 'oldPassword', 'NewPassword123!');

      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'new-hashed-password' },
      });

      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw error for incorrect current password', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'old-hashed-password',
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(authService.changePassword('user-1', 'wrongPassword', 'NewPassword123!')).rejects.toThrow(
        new AuthenticationError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD')
      );
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired and revoked tokens', async () => {
      mockPrismaRefreshToken.deleteMany.mockResolvedValue({ count: 5 });
      mockPrismaUser.updateMany.mockResolvedValue({ count: 2 });

      await authService.cleanupExpiredTokens();

      expect(mockPrismaRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { isRevoked: true },
          ],
        },
      });

      expect(mockPrismaUser.updateMany).toHaveBeenCalledWith({
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