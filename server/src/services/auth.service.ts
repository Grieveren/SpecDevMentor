import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient, User, UserRole } from '@prisma/client';
import { Redis } from 'redis';

const prisma = new PrismaClient();

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export class AuthenticationError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly REFRESH_SECRET: string;
  private readonly redis: Redis;
  private readonly revokedTokens: Set<string> = new Set();

  constructor(redis: Redis) {
    this.JWT_SECRET = process.env.JWT_SECRET!;
    this.REFRESH_SECRET = process.env.REFRESH_SECRET!;
    this.redis = redis;

    if (!this.JWT_SECRET || !this.REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    // Load revoked tokens from Redis on startup
    this.loadRevokedTokens();
  }

  private async loadRevokedTokens(): Promise<void> {
    try {
      const tokens = await this.redis.sMembers('revoked_tokens');
      tokens.forEach(token => this.revokedTokens.add(token));
    } catch (error) {
      console.error('Failed to load revoked tokens:', error);
    }
  }

  async register(data: RegisterRequest): Promise<{ user: Omit<User, 'password'>; tokens: TokenPair }> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AuthenticationError('User already exists with this email', 'USER_EXISTS');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        password: hashedPassword,
        verificationToken,
        role: UserRole.DEVELOPER, // Default role
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  async login(data: LoginRequest): Promise<{ user: Omit<User, 'password'>; tokens: TokenPair }> {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.REFRESH_SECRET) as { userId: string; jti: string };

      // Check if refresh token exists in database and is not revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });

      if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
        throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }

      // Revoke old refresh token
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
      });

      // Generate new tokens
      const tokens = await this.generateTokens(storedToken.user);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  }

  async generateTokens(user: User): Promise<TokenPair> {
    const jti = crypto.randomUUID();

    // Generate access token (15 minutes)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        jti,
      },
      this.JWT_SECRET,
      {
        expiresIn: '15m',
        issuer: 'codementor-ai',
        audience: 'codementor-ai-client',
      }
    );

    // Generate refresh token (7 days)
    const refreshTokenPayload = { userId: user.id, jti };
    const refreshToken = jwt.sign(refreshTokenPayload, this.REFRESH_SECRET, {
      expiresIn: '7d',
    });

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'codementor-ai',
        audience: 'codementor-ai-client',
      }) as JWTPayload;

      // Check if token is revoked
      if (this.revokedTokens.has(payload.jti)) {
        throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token', 'INVALID_TOKEN');
      }
      throw error;
    }
  }

  async revokeToken(jti: string): Promise<void> {
    this.revokedTokens.add(jti);
    // Store in Redis for distributed systems
    await this.redis.sAdd('revoked_tokens', jti);
    
    // Set expiration for cleanup (match JWT expiration)
    await this.redis.expire('revoked_tokens', 15 * 60); // 15 minutes
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      // Revoke refresh token in database
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { isRevoked: true },
      });
    } catch (error) {
      // Log error but don't throw - logout should always succeed
      console.error('Error during logout:', error);
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists or not
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // TODO: Send email with reset token
    // This would typically integrate with an email service
    console.log(`Password reset token for ${email}: ${resetToken}`);
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        resetToken: data.token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 12);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Revoke all existing refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      throw new AuthenticationError('Invalid verification token', 'INVALID_VERIFICATION_TOKEN');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthenticationError('User not found', 'USER_NOT_FOUND');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new AuthenticationError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all existing refresh tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  async getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async cleanupExpiredTokens(): Promise<void> {
    // Clean up expired refresh tokens
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true },
        ],
      },
    });

    // Clean up expired reset tokens
    await prisma.user.updateMany({
      where: {
        resetTokenExpiry: { lt: new Date() },
      },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }
}