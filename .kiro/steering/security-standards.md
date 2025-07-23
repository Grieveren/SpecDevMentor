# Security Standards

## Code Execution Sandbox Security

### Docker Sandbox Configuration

```typescript
// Secure Docker container configuration for code execution
interface SandboxConfig {
  image: string;
  memoryLimit: string;
  cpuLimit: string;
  timeoutMs: number;
  networkMode: 'none' | 'bridge';
  readOnlyRootfs: boolean;
  noNewPrivileges: boolean;
  user: string;
}

class SecureCodeExecutor {
  private readonly SANDBOX_CONFIGS: Record<string, SandboxConfig> = {
    javascript: {
      image: 'node:18-alpine',
      memoryLimit: '128m',
      cpuLimit: '0.5',
      timeoutMs: 30000,
      networkMode: 'none',
      readOnlyRootfs: true,
      noNewPrivileges: true,
      user: 'node',
    },
    python: {
      image: 'python:3.11-alpine',
      memoryLimit: '128m',
      cpuLimit: '0.5',
      timeoutMs: 30000,
      networkMode: 'none',
      readOnlyRootfs: true,
      noNewPrivileges: true,
      user: 'python',
    },
  };

  async executeCode(request: CodeExecutionRequest): Promise<ExecutionResult> {
    // Validate and sanitize input
    const sanitizedCode = this.sanitizeCode(request.code);
    const config = this.SANDBOX_CONFIGS[request.language];

    if (!config) {
      throw new SecurityError(`Unsupported language: ${request.language}`);
    }

    // Create isolated container
    const container = await this.createSandbox(config, sanitizedCode);

    try {
      // Execute with strict limits
      const result = await this.runWithTimeout(container, config.timeoutMs);
      return this.sanitizeOutput(result);
    } finally {
      // Always cleanup container
      await this.cleanupContainer(container);
    }
  }

  private sanitizeCode(code: string): string {
    // Remove potentially dangerous operations
    const dangerousPatterns = [
      /require\s*\(\s*['"]fs['"]/, // File system access
      /require\s*\(\s*['"]child_process['"]/, // Process execution
      /require\s*\(\s*['"]net['"]/, // Network access
      /eval\s*\(/, // Dynamic code execution
      /Function\s*\(/, // Function constructor
      /import\s+.*\s+from\s+['"]fs['"]/, // ES6 imports
      /process\./, // Process object access
      /__dirname|__filename/, // File system paths
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new SecurityError('Code contains potentially dangerous operations');
      }
    }

    return code;
  }

  private async createSandbox(config: SandboxConfig, code: string): Promise<Docker.Container> {
    const docker = new Docker();

    return await docker.createContainer({
      Image: config.image,
      Cmd: this.getExecutionCommand(code),
      HostConfig: {
        Memory: this.parseMemoryLimit(config.memoryLimit),
        CpuQuota: Math.floor(config.cpuLimit * 100000),
        CpuPeriod: 100000,
        NetworkMode: config.networkMode,
        ReadonlyRootfs: config.readOnlyRootfs,
        SecurityOpt: ['no-new-privileges:true'],
        CapDrop: ['ALL'], // Drop all capabilities
        Ulimits: [
          { Name: 'nofile', Soft: 64, Hard: 64 }, // Limit file descriptors
          { Name: 'nproc', Soft: 32, Hard: 32 }, // Limit processes
        ],
      },
      User: config.user,
      WorkingDir: '/tmp',
      AttachStdout: true,
      AttachStderr: true,
    });
  }
}
```

### Input Validation and Sanitization

```typescript
// Comprehensive input validation
class InputValidator {
  static validateSpecificationContent(content: string): ValidationResult {
    const errors: string[] = [];

    // Check for malicious content
    if (this.containsMaliciousPatterns(content)) {
      errors.push('Content contains potentially malicious patterns');
    }

    // Validate length limits
    if (content.length > 100000) {
      // 100KB limit
      errors.push('Content exceeds maximum length limit');
    }

    // Check for valid UTF-8
    if (!this.isValidUTF8(content)) {
      errors.push('Content contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static sanitizeUserInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  private static containsMaliciousPatterns(content: string): boolean {
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      /eval\s*\(/i,
      /expression\s*\(/i,
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }
}
```

## Authentication and Authorization

### JWT Security Implementation

```typescript
// Secure JWT handling
interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

class AuthenticationService {
  private readonly JWT_SECRET: string;
  private readonly REFRESH_SECRET: string;
  private readonly revokedTokens: Set<string> = new Set();

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET!;
    this.REFRESH_SECRET = process.env.REFRESH_SECRET!;

    if (!this.JWT_SECRET || !this.REFRESH_SECRET) {
      throw new Error('JWT secrets not configured');
    }
  }

  async generateTokens(user: User): Promise<TokenPair> {
    const jti = crypto.randomUUID();

    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        jti,
      },
      this.JWT_SECRET,
      {
        expiresIn: '15m',
        issuer: 'codementor-ai',
        audience: 'codementor-ai-client',
      }
    );

    const refreshToken = jwt.sign({ userId: user.id, jti }, this.REFRESH_SECRET, {
      expiresIn: '7d',
    });

    // Store refresh token securely
    await this.storeRefreshToken(user.id, refreshToken, jti);

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
        throw new AuthenticationError('Token has been revoked');
      }

      return payload;
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }

  async revokeToken(jti: string): Promise<void> {
    this.revokedTokens.add(jti);
    // Also store in persistent storage for distributed systems
    await this.redis.sadd('revoked_tokens', jti);
  }
}
```

### Role-Based Access Control (RBAC)

```typescript
// Permission system for specification access
enum Permission {
  READ_SPECIFICATION = 'read:specification',
  WRITE_SPECIFICATION = 'write:specification',
  DELETE_SPECIFICATION = 'delete:specification',
  MANAGE_TEAM = 'manage:team',
  EXECUTE_CODE = 'execute:code',
  ACCESS_AI_REVIEW = 'access:ai_review',
  VIEW_ANALYTICS = 'view:analytics',
  ADMIN_SYSTEM = 'admin:system',
}

enum UserRole {
  STUDENT = 'student',
  DEVELOPER = 'developer',
  TEAM_LEAD = 'team_lead',
  ADMIN = 'admin',
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: [
    Permission.READ_SPECIFICATION,
    Permission.WRITE_SPECIFICATION,
    Permission.EXECUTE_CODE,
  ],
  [UserRole.DEVELOPER]: [
    Permission.READ_SPECIFICATION,
    Permission.WRITE_SPECIFICATION,
    Permission.EXECUTE_CODE,
    Permission.ACCESS_AI_REVIEW,
  ],
  [UserRole.TEAM_LEAD]: [
    Permission.READ_SPECIFICATION,
    Permission.WRITE_SPECIFICATION,
    Permission.DELETE_SPECIFICATION,
    Permission.MANAGE_TEAM,
    Permission.EXECUTE_CODE,
    Permission.ACCESS_AI_REVIEW,
    Permission.VIEW_ANALYTICS,
  ],
  [UserRole.ADMIN]: Object.values(Permission),
};

// Authorization middleware
const requirePermission = (permission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission = user.permissions.includes(permission);

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: permission,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

// Resource-level authorization
const requireProjectAccess = (action: 'read' | 'write' | 'delete') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { projectId } = req.params;
    const userId = req.user.id;

    const access = await checkProjectAccess(userId, projectId, action);

    if (!access.allowed) {
      return res.status(403).json({
        error: 'Access denied to project',
        reason: access.reason,
      });
    }

    next();
  };
};
```

## Data Protection and Privacy

### Encryption at Rest and in Transit

```typescript
// Data encryption utilities
class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationIterations = 100000;

  async encryptSensitiveData(data: string, userKey?: string): Promise<EncryptedData> {
    const key = userKey ? await this.deriveKey(userKey) : await this.getSystemKey();

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from('codementor-ai'));

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
    };
  }

  async decryptSensitiveData(encryptedData: EncryptedData, userKey?: string): Promise<string> {
    const key = userKey ? await this.deriveKey(userKey) : await this.getSystemKey();

    const decipher = crypto.createDecipher(encryptedData.algorithm, key);

    decipher.setAAD(Buffer.from('codementor-ai'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async deriveKey(password: string): Promise<Buffer> {
    const salt = Buffer.from(process.env.ENCRYPTION_SALT!, 'hex');
    return crypto.pbkdf2Sync(password, salt, this.keyDerivationIterations, 32, 'sha256');
  }
}
```

### Audit Logging

```typescript
// Comprehensive audit logging
interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

class AuditLogger {
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Store in secure audit log
    await this.storeAuditEvent(auditEvent);

    // Alert on suspicious activities
    if (this.isSuspiciousActivity(auditEvent)) {
      await this.alertSecurityTeam(auditEvent);
    }
  }

  private isSuspiciousActivity(event: AuditEvent): boolean {
    const suspiciousPatterns = [
      // Multiple failed login attempts
      event.action === 'login' && !event.success,
      // Unauthorized access attempts
      event.action.includes('unauthorized'),
      // Bulk data access
      event.action === 'bulk_export',
      // Admin actions by non-admin users
      event.action.startsWith('admin:') && !event.details.isAdmin,
    ];

    return suspiciousPatterns.some(Boolean);
  }
}

// Audit middleware for API endpoints
const auditMiddleware = (action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Capture original response methods
    const originalSend = res.send;
    const originalJson = res.json;

    let responseBody: any;
    let success = true;

    res.send = function (body) {
      responseBody = body;
      success = res.statusCode < 400;
      return originalSend.call(this, body);
    };

    res.json = function (body) {
      responseBody = body;
      success = res.statusCode < 400;
      return originalJson.call(this, body);
    };

    res.on('finish', async () => {
      try {
        await auditLogger.log({
          userId: req.user?.id || 'anonymous',
          action,
          resource: req.route?.path || req.path,
          resourceId: req.params.id || '',
          details: {
            method: req.method,
            query: req.query,
            body: this.sanitizeRequestBody(req.body),
            responseTime: Date.now() - startTime,
            statusCode: res.statusCode,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || '',
          success,
          errorMessage: success ? undefined : responseBody?.error,
        });
      } catch (error) {
        console.error('Audit logging failed:', error);
      }
    });

    next();
  };
};
```

## Rate Limiting and DDoS Protection

```typescript
// Advanced rate limiting
class RateLimiter {
  private readonly redis: Redis;
  private readonly limits: Map<string, RateLimit> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
    this.setupDefaultLimits();
  }

  private setupDefaultLimits() {
    this.limits.set('api:general', { requests: 100, window: 60 }); // 100 req/min
    this.limits.set('api:ai_review', { requests: 10, window: 60 }); // 10 AI reviews/min
    this.limits.set('api:code_execution', { requests: 20, window: 60 }); // 20 executions/min
    this.limits.set('auth:login', { requests: 5, window: 300 }); // 5 login attempts/5min
  }

  async checkLimit(key: string, identifier: string): Promise<RateLimitResult> {
    const limit = this.limits.get(key);
    if (!limit) {
      return { allowed: true, remaining: Infinity, resetTime: 0 };
    }

    const redisKey = `rate_limit:${key}:${identifier}`;
    const current = await this.redis.incr(redisKey);

    if (current === 1) {
      await this.redis.expire(redisKey, limit.window);
    }

    const ttl = await this.redis.ttl(redisKey);
    const resetTime = Date.now() + ttl * 1000;

    return {
      allowed: current <= limit.requests,
      remaining: Math.max(0, limit.requests - current),
      resetTime,
    };
  }
}

// Rate limiting middleware
const rateLimit = (limitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip + ':' + (req.user?.id || 'anonymous');
    const result = await rateLimiter.checkLimit(limitKey, identifier);

    res.set({
      'X-RateLimit-Limit': result.limit?.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
    });

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      });
    }

    next();
  };
};
```
